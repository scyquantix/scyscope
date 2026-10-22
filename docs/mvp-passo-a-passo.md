# MVP no ar: passo a passo

Como colocar a **versão A** (Ferraz de Vasconcelos) em produção nos planos gratuitos, seguindo o [projeto de deploy](deploy.md). Cada etapa termina com uma verificação. Só avance com ela passando.

Convenções:
- **Ref do projeto Supabase:** `<ref>`.
- **ID da conta Cloudflare:** `<account-id>`.
- **Subdomínio:** `scope.scyquantix.com` (troque se a decisão for outra).
- ☐ marca algo a fazer; os comandos rodam no terminal do Codespace, salvo indicação.

Visão geral:

| Etapa | O quê | Muda código? | Esforço estimado |
| --- | --- | --- | --- |
| 0 | Contas e serviços | Não | ½ dia |
| 1 | Codespaces e CI | Sim (configuração) | ½ dia |
| 2 | Banco no Supabase | Sim (migrations) | 1 dia |
| 3 | Pipeline de dados | Sim (`pipeline/`) | 3 a 5 dias |
| 4 | App em Postgres | Sim (`src/`) | 3 a 5 dias |
| 5 | Publicação na Vercel | Não | ½ dia |
| 6 | Domínio | Não | 1 hora mais a propagação |
| 7 | Operação | Pouco | ½ dia |
| 8 | Limpeza | Sim | ½ dia |

As etapas 3 e 4 podem andar em paralelo depois da 2.

---

## Etapa 0: contas e serviços

### 0.1 GitHub

☐ **Environment de produção.** Em `scyquantix/scyscope` → **Settings → Environments → New environment**, crie `producao`. Em *Deployment branches and tags*, escolha *Selected branches* e adicione `main`.

☐ **Codespaces na organização.** Em `github.com/organizations/scyquantix/settings` → **Codespaces**:
- habilite para os membros;
- em **Billing**, mantenha o limite de gastos da organização em US$ 0 durante a validação, para que o uso saia da cota gratuita de cada conta pessoal.

☐ **Acesso à organização.** Confira que o perfil `clockworkrebel` é **owner**, para conseguir criar os segredos.

### 0.2 Supabase

☐ Entre em `supabase.com` com a conta do GitHub e crie a organização **ScyQuantix** no plano **Free**.

☐ Crie o projeto:
- **Name:** `scyscope`;
- **Region:** *South America (São Paulo)*;
- **Database password:** gere uma senha forte e guarde no gerenciador de senhas da empresa. Ela vira o segredo `SUPABASE_DB_PASSWORD`.

☐ Anote o **ref** do projeto, que aparece na URL (`supabase.com/dashboard/project/<ref>`).

☐ Em **Database → Extensions**, confirme que `pg_stat_statements` está ativa.

☐ Em **Project Settings → Data API**, confira que só `public` e `graphql_public` estão expostos. Os schemas do ScyScope **não** devem entrar ali.

☐ Em **Account → Access Tokens**, crie um token chamado `github-actions-scyscope`. Ele vira o segredo `SUPABASE_ACCESS_TOKEN`.

### 0.3 Cloudflare R2

☐ No painel da Cloudflare (a mesma conta onde está o domínio), abra **R2 Object Storage** e ative o serviço. A Cloudflare pode pedir um meio de pagamento mesmo para o plano gratuito.

☐ Crie dois buckets com *Location: Provide a location hint* → **Eastern North America (ENAM)** e *Default storage class: Standard*:
- `scyscope-dados`
- `scyscope-exportacoes`

☐ Em `scyscope-exportacoes` → **Settings → Object lifecycle rules**, adicione uma regra para o prefixo `exportacoes/` que **apaga objetos após 1 dia**.

☐ Em **R2 → Manage API tokens**, crie dois tokens com permissão **Object Read & Write**, cada um limitado ao seu bucket:

| Token | Bucket | Vira os segredos |
| --- | --- | --- |
| `pipeline-scyscope` | `scyscope-dados` | `R2_DADOS_ACCESS_KEY_ID`, `R2_DADOS_SECRET_ACCESS_KEY` |
| `app-scyscope` | `scyscope-exportacoes` | `R2_EXPORT_ACCESS_KEY_ID`, `R2_EXPORT_SECRET_ACCESS_KEY` |

☐ Anote o **Account ID** (vira `R2_ACCOUNT_ID`). O endpoint S3 é `https://<account-id>.r2.cloudflarestorage.com`.

### 0.4 Vercel

☐ Entre em `vercel.com` com o GitHub (`clockworkrebel`), no plano **Hobby**.

☐ Em **Add New → Project → Import Git Repository**, clique em *Adjust GitHub App Permissions* e instale o app da Vercel na organização **scyquantix**, com acesso só ao repositório `scyscope`.

☐ **Ainda não importe o projeto.** Isso fica para a etapa 5, quando o app já ler do Supabase. Este passo só confirma que o repositório aparece na lista.

Se o repositório não aparecer ou a Vercel recusar por ser de organização, siga com o plano B da etapa 5.4 (publicação pelo Actions).

### 0.5 Verificação da etapa 0

- ☐ Projeto Supabase em São Paulo, com ref, senha e token anotados.
- ☐ Dois buckets R2, dois tokens e o Account ID anotados.
- ☐ Repositório visível na tela de importação da Vercel.
- ☐ Environment `producao` criado no GitHub.

---

## Etapa 1: Codespaces e CI

### 1.1 Devcontainer

☐ Criar `.devcontainer/devcontainer.json` com:
- imagem base `mcr.microsoft.com/devcontainers/typescript-node:24`;
- features: Python 3.12, Java 17, docker-in-docker e a CLI do Supabase;
- `hostRequirements.cpus: 4`;
- `postCreateCommand` com `npm ci && pip install -e "pipeline[dev]"`;
- `postStartCommand` com `supabase start`;
- porta 3100 encaminhada.

### 1.2 Segredos do Codespace

☐ Em **Settings → Secrets and variables → Codespaces** do repositório, cadastre `R2_ACCOUNT_ID`, `R2_DADOS_ACCESS_KEY_ID` e `R2_DADOS_SECRET_ACCESS_KEY`. No Codespace, o pipeline usa o prefixo `dev/` do bucket.

### 1.3 CI

☐ Criar `.github/workflows/ci.yml`, disparado em `push` e `pull_request`, com:
- `npm ci`, `npm run typecheck` e `npm run build`;
- na etapa 3, também `pytest` do pipeline.

### 1.4 Ruleset

☐ Depois do primeiro CI verde, edite o ruleset "Proteger main" (**Settings → Rules**) e adicione **Require status checks to pass** com o job do CI.

### 1.5 Verificação

- ☐ **Code → Codespaces → Create codespace on main** abre sem erro.
- ☐ No terminal do Codespace:
  ```bash
  node --version        # v24.x
  python --version      # 3.12.x
  java -version         # 17
  supabase status       # API e DB locais no ar
  npm run typecheck
  ```
- ☐ O CI aparece verde no PR que adiciona esses arquivos.

---

## Etapa 2: banco no Supabase

### 2.1 Estrutura

☐ No Codespace, rode `supabase init`. Isso cria `supabase/config.toml` e `supabase/migrations/`.

☐ Escreva as migrations, nesta ordem:

| Arquivo | Conteúdo |
| --- | --- |
| `0001_schemas_papeis.sql` | Schemas `siconfi`, `tce`, `ibge`, `bacen` e `app`; papéis `scyscope_leitor`, `scyscope_registro` e `scyscope_carga` **sem senha**; parâmetros do leitor (`default_transaction_read_only`, `statement_timeout = '15s'`, `idle_in_transaction_session_timeout = '30s'`) |
| `0002_marts.sql` | Tabelas de mart com os nomes de hoje, mais a coluna `cod_ibge` nas tabelas de fato e `ordem` em `siconfi.linhas`; índices equivalentes aos do SQLite; `COMMENT ON` com as descrições de `src/lib/fontes.ts` |
| `0003_registro.sql` | `app.consultas`, `app.eventos` (particionada por mês), `app.versao_dados`, a função `app.registrar_evento` e as views de análise ([deploy.md, seção 5](deploy.md#5-registro-de-consultas-para-análise)) |
| `0004_permissoes.sql` | `GRANT`s de cada papel e `REVOKE` de `public` |

### 2.2 Teste local

☐ Rode as migrations no Supabase local:

```bash
supabase db reset          # aplica as migrations do zero no banco local
```

☐ Teste de segurança local. Defina uma senha local para o leitor e confira as restrições:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -c "alter role scyscope_leitor with login password 'local'"
psql "postgresql://scyscope_leitor:local@127.0.0.1:54322/postgres" <<'SQL'
select 1;                               -- funciona
create table tce.x (id int);            -- deve falhar: transação somente leitura
select * from app.eventos;              -- deve falhar: sem permissão
select pg_sleep(20);                    -- deve ser cancelado em 15 s
SQL
```

### 2.3 Produção

☐ Vincule o projeto e envie as migrations:

```bash
supabase login                         # use o token da etapa 0.2
supabase link --project-ref <ref>
supabase db push
```

☐ No **SQL Editor** do painel, defina as senhas dos papéis. Gere três senhas fortes e guarde no gerenciador:

```sql
alter role scyscope_leitor   with login password '...';
alter role scyscope_registro with login password '...';
alter role scyscope_carga    with login password '...';
```

☐ Em **Connect** (botão no topo do painel), copie as duas strings de conexão e troque o usuário pelo papel. O formato do usuário no pooler é `papel.<ref>`:

| Segredo | Modo | Exemplo de formato |
| --- | --- | --- |
| `DATABASE_URL_LEITOR` | Transaction pooler | `postgresql://scyscope_leitor.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` |
| `DATABASE_URL_REGISTRO` | Transaction pooler | o mesmo, com `scyscope_registro` |
| `SUPABASE_CARGA_URL` | Session pooler | `postgresql://scyscope_carga.<ref>:<senha>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres` |

O host exato aparece no painel; use o que estiver lá.

### 2.4 Segredos do Actions

☐ Em **Settings → Environments → producao → Environment secrets**, cadastre:
- `SUPABASE_CARGA_URL`;
- `R2_ACCOUNT_ID`, `R2_DADOS_ACCESS_KEY_ID` e `R2_DADOS_SECRET_ACCESS_KEY`;
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` e `SUPABASE_DB_PASSWORD`.

☐ Crie `.github/workflows/migrations.yml`, que roda `supabase db push` quando algo muda em `supabase/migrations/` na `main`, usando o environment `producao`.

### 2.5 Verificação

- ☐ Em **Table Editor** (seletor de schema), aparecem `siconfi`, `tce`, `ibge`, `bacen` e `app`, com as tabelas vazias.
- ☐ O teste de segurança de 2.2, repetido contra a URL do leitor em produção, dá os mesmos resultados.
- ☐ `supabase migration list` mostra as 4 migrations aplicadas local e remotamente.

---

## Etapa 3: pipeline de dados

### 3.1 Estrutura

```
pipeline/
  pyproject.toml                 # pyspark, httpx, psycopg[binary], boto3, pytest
  scyscope_pipeline/
    config.py                    # município, endpoints, caminhos no R2 (prefixo dev/ fora do Actions)
    r2.py                        # leitura e escrita no R2 (boto3) e configuração do s3a para o Spark
    coleta/{siconfi,tce,ibge,bacen}.py      # HTTP paginado → bronze (porte do scripts/sync.mjs)
    transforma/{siconfi,tce,ibge,bacen}.py  # Spark: bronze → silver → gold
    qualidade.py                 # verificações de 4.4 do projeto
    carga.py                     # gold → schema carga_<fonte> → troca de schema
    __main__.py                  # python -m scyscope_pipeline <fonte> [--ano AAAA] [--etapa coleta|transforma|carga]
  tests/                         # amostras de JSON reais e testes das transformações
```

### 3.2 Ordem sugerida

Comece pelas fontes mais simples, para validar o encanamento antes do volume:

1. ☐ **BACEN:** 4 séries pequenas. Valida R2, Spark e carga de ponta a ponta.
2. ☐ **IBGE:** duas chamadas.
3. ☐ **SICONFI:** paginação, extrato de entregas e coluna `ordem`.
4. ☐ **TCE-SP:** o maior volume e a separação do `id_fornecedor`.

### 3.3 Execução no Codespace

```bash
python -m scyscope_pipeline bacen          # coleta, transforma e carrega no Supabase local
python -m scyscope_pipeline tce --ano 2025
```

### 3.4 Validação contra o SQLite atual

Compare com os números de `data/fontes/*.db`. As contagens podem crescer se a API recebeu dados novos desde 17/10/2026:

| Tabela | SQLite atual |
| --- | --- |
| `siconfi.linhas` | 47.645 |
| `siconfi.entregas` | 177 |
| `tce.despesas` | 97.529 |
| `tce.receitas` | 7.931 |
| `ibge.populacao` | 23 |

☐ As contagens batem.

☐ A conferência TCE-SP × SICONFI (exemplo "Conferência TCE-SP × SICONFI") dá 0,00% em 2024, 2025 e 2026.

### 3.5 Workflow de produção

☐ Crie `.github/workflows/pipeline.yml` com:
- `workflow_dispatch` com as entradas `fonte` (siconfi, tce, ibge, bacen, todas) e `ano` (opcional);
- `schedule`, **comentado por enquanto**;
- `environment: producao` e `concurrency: pipeline-${{ inputs.fonte }}`;
- passos: checkout, `setup-python` com cache do pip, `setup-java` 17, cache dos JARs do Spark e `python -m scyscope_pipeline ${{ inputs.fonte }}`;
- nenhum `echo` de variável de ambiente.

☐ Rode manualmente cada fonte em **Actions → pipeline → Run workflow**, na ordem de 3.2.

### 3.6 Verificação

- ☐ As quatro execuções manuais terminam verdes.
- ☐ O bucket `scyscope-dados` tem `bronze/`, `silver/` e `gold/` para as quatro fontes.
- ☐ No SQL Editor do Supabase, as contagens batem com 3.4, e `app.versao_dados` tem uma linha por fonte.
- ☐ Os logs públicos do Actions não mostram nenhuma URL nem chave.

---

## Etapa 4: app em Postgres

Mudanças de código, cada uma num PR com o CI verde, testadas contra o Supabase local no Codespace:

1. ☐ **`src/lib/banco.ts`:** clientes postgres.js para leitor e registro, com `prepare: false`, URLs vindas do ambiente e `max: 1` por instância serverless.
2. ☐ **Execução:** `src/lib/executar.ts` passa a usar `BEGIN READ ONLY`, um cursor limitado a 5.000 linhas ou cerca de 3,5 MB, e `EXPLAIN (FORMAT JSON)`. Saem os workers e o autorizador.
3. ☐ **Introspecção:** `src/lib/esquema.ts` passa a ler `information_schema` e `pg_catalog`, e o catálogo mostra o "atualizado em" de `coletas`.
4. ☐ **Páginas:** a navegação por tabela (`/tabelas/[tabela]`) e os Relatórios (`/anexos`) passam para o dialeto Postgres (`ordem` no lugar de `rowid`, `pg_typeof`).
5. ☐ **Exemplos:** `src/lib/exemplos.ts` portados, cada um testado.
6. ☐ **Aba Plano:** lê o JSON do Postgres (Seq Scan e Index Scan).
7. ☐ **Salvas e histórico no navegador:** o `localStorage` substitui `src/lib/estado.ts`, e cada navegador ganha um UUID de sessão.
8. ☐ **Registro de eventos:** `app.registrar_evento` chamado com `after()`, só quando `VERCEL_ENV === "production"`.
9. ☐ **Exportação via R2:** `/api/exportar` grava em `scyscope-exportacoes` e devolve a URL assinada ([deploy.md, seção 6.3](deploy.md#63-exportação-arquivo-no-r2-com-url-assinada-recomendado)).
10. ☐ **`/api/saude`:** faz um `SELECT 1` e devolve 200.
11. ☐ **Região:** `vercel.json` com `"regions": ["gru1"]`.

Verificação:
- ☐ No Codespace, com o Supabase local carregado pela etapa 3, todas as telas funcionam: consulta, catálogo, tabela, relatórios, gráfico, plano e exportação.
- ☐ Uma consulta com resultado acima de 3,5 MB aparece como "cortada", sem erro.
- ☐ Uma exportação de 100 mil linhas ou mais baixa pelo link do R2.

---

## Etapa 5: publicação na Vercel

### 5.1 Importar o projeto

☐ Em **Add New → Project**, importe `scyquantix/scyscope`:
- **Framework:** Next.js (detectado);
- **Root Directory:** `./`;
- **Build Command** e **Output:** os padrões.

### 5.2 Variáveis de ambiente

☐ Antes do primeiro deploy, em **Environment Variables**, cadastre:

| Variável | Production | Preview |
| --- | --- | --- |
| `DATABASE_URL_LEITOR` | ✓ | ✓ |
| `DATABASE_URL_REGISTRO` | ✓ | (não) |
| `R2_ACCOUNT_ID`, `R2_EXPORT_ACCESS_KEY_ID`, `R2_EXPORT_SECRET_ACCESS_KEY` | ✓ | ✓ |

### 5.3 Configurações do projeto

☐ Em **Settings → General → Node.js Version**, escolha **24.x**.

☐ Em **Settings → Functions**, confira a região **São Paulo (gru1)**. O `vercel.json` já define, mas vale conferir.

☐ Clique em **Deploy**.

### 5.4 Plano B: publicação pelo Actions

Use só se a importação da 5.1 for recusada:

☐ Em **Account Settings → Tokens**, crie um token. Cadastre `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` no environment `producao` do GitHub. Os dois IDs saem de `vercel link`, rodado uma vez no Codespace.

☐ Crie `.github/workflows/deploy.yml`, disparado em push na `main`, com `vercel pull`, `vercel build --prod` e `vercel deploy --prebuilt --prod`.

### 5.5 Verificação

- ☐ O endereço `scyscope-<algo>.vercel.app` abre com o primeiro exemplo executado.
- ☐ Catálogo, tabela, relatórios e exportação funcionam.
- ☐ Em **Deployments → Functions**, as funções aparecem em `gru1`.
- ☐ Depois de algumas consultas, `select count(*) from app.eventos` no Supabase é maior que zero.
- ☐ Abra um PR qualquer: o preview funciona e **não** gera eventos.

---

## Etapa 6: domínio

☐ **Na Vercel:** em **Settings → Domains → Add**, informe `scope.scyquantix.com`. A Vercel mostra o registro **CNAME** a criar.

☐ **Na Cloudflare:** em **scyquantix.com → DNS → Records → Add record**, crie:
- **Type:** CNAME;
- **Name:** `scope`;
- **Target:** o valor indicado pela Vercel;
- **Proxy status:** **DNS only** (nuvem cinza).

☐ Aguarde a Vercel marcar o domínio como **Valid Configuration**. O certificado HTTPS é emitido sozinho.

Verificação:
- ☐ O comando abaixo responde 200, e o navegador mostra o cadeado sem aviso.
  ```bash
  dig +short scope.scyquantix.com        # retorna o alvo da Vercel
  curl -sI https://scope.scyquantix.com | head -1
  ```

---

## Etapa 7: operação

☐ **Agendamentos.** Descomente o `schedule` do `pipeline.yml`:
- BACEN: diário, às 06:00 de Brasília, que é `0 9 * * *` em UTC;
- TCE-SP e SICONFI: semanal, às segundas, `0 10 * * 1`;
- IBGE: mensal, dia 5, `0 11 5 * *`.

☐ **Alerta de falha.** Em **GitHub → Settings → Notifications → Actions**, ative o e-mail para execuções com falha. Se quiserem alerta no Slack ou no WhatsApp, entra um passo extra no workflow.

☐ **Monitor de disponibilidade.** Num serviço gratuito (UptimeRobot, Better Stack ou similar), monitore `https://scope.scyquantix.com/api/saude` a cada 5 minutos, com alerta por e-mail. Isso também mantém o Supabase gratuito ativo.

☐ **Privacidade.** Inclua na política de privacidade da ScyQuantix o registro anônimo de consultas ([deploy.md, seção 5.4](deploy.md#54-privacidade-lgpd)) e coloque o link no rodapé do app.

☐ **Rotina semanal** (15 minutos):
- olhar `app.top_consultas_30d`, `app.erros_frequentes` e `app.consultas_lentas`;
- conferir o tamanho do banco em **Reports → Database**: alerta acima de 300 MB, e o limite é 500 MB;
- conferir se as cargas da semana passaram.

Verificação:
- ☐ Uma semana inteira de cargas agendadas verdes, sem intervenção.
- ☐ O monitor registra 100% de disponibilidade na semana, ou as quedas estão explicadas.

---

## Etapa 8: limpeza

☐ Remova `data/fontes/siconfi.db`, `workers/`, `scripts/sync.mjs` e as regras de `data/` no `.gitignore`.

☐ Reescreva o README:
- produção em `https://scope.scyquantix.com`;
- desenvolvimento no Codespaces com o Supabase local;
- pipeline em `pipeline/`.

☐ Marque `docs/deploy.md` como **implementado (versão A)** e registre o que mudou em relação à proposta.

---

## Definição de pronto do MVP

- [ ] `https://scope.scyquantix.com` no ar, com HTTPS, servido de `gru1`.
- [ ] As quatro fontes carregadas pelo pipeline, com contagens conferidas e conferência TCE × SICONFI passando.
- [ ] Cargas agendadas rodando sozinhas há pelo menos uma semana.
- [ ] Consultas registradas em `app.eventos`, com as views de análise respondendo.
- [ ] Exportação de 200 mil linhas funcionando pelo R2.
- [ ] Nenhum segredo no repositório nem nos logs públicos.
- [ ] Custo mensal: US$ 0.

## Depois do MVP: rumo à versão B

1. **Medir:** usar as views de análise para ver quais tabelas e comparações as pessoas querem.
2. **B0, ainda gratuita:**
   - coleta do estado inteiro só no R2 (`matrix` por fatias de municípios, com manifesto de retomada);
   - marts agregados no Supabase;
   - downloads por município no catálogo.
3. **B1, paga:**
   - Supabase Pro com compute Small ou Medium;
   - modelo normalizado e particionado, com views com os nomes de hoje;
   - seletor de município na interface;
   - Vercel Pro.
