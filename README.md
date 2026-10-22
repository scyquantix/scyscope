# ScyScope

**Explore dados públicos do Brasil com SQL.** Um produto [ScyQuantix](https://scyquantix.com), "Tecnologia orientada por evidências", da família Scy Scope · Scy Pivot · Scy Canvas.

O ScyScope baixa dados de APIs públicas para bancos SQLite locais e deixa você consultá-los com SQL, cruzando fontes. Cada API é um esquema com o próprio nome, então toda consulta diz de onde vem cada número:

```sql
SELECT p.ano, p.populacao, i.indice
FROM ibge.populacao p
JOIN bacen.ipca i ON i.mes = p.ano || '-12';
```

> **Estado:** MVP em desenvolvimento, rodando localmente, com um município, Ferraz de Vasconcelos (SP), código IBGE 3515707. Já tem login com usuários locais; o deploy está planejado ([seção Plano de deploy](#plano-de-deploy)), mas ainda não foi feito.

## Funcionalidades

### Consulta SQL (`/`)
- Editor com destaque de sintaxe, numeração de linhas e atalhos: `Ctrl+Enter` executa (só a seleção, se houver) e `Ctrl+S` salva.
- Lateral com o esquema agrupado por fonte. Cada tabela mostra o órgão, uma descrição, a contagem de linhas e as colunas com o tipo, e um clique insere o nome no editor.
- Dez consultas de exemplo, etiquetadas com as fontes que usam. Várias cruzam esquemas, como receita per capita corrigida pelo IPCA e a conferência entre TCE-SP e SICONFI.
- Consultas salvas e histórico das execuções, de cada usuário, guardados em `data/explorer.db`.
- Resultado em três abas: **tabela** (ordenável, com números formatados), **gráfico** (barras ou linhas, com escolha das séries) e **plano de execução** (`EXPLAIN QUERY PLAN`, com varreduras completas destacadas).
- Exportação CSV de até 200 mil linhas, cópia do resultado e link compartilhável: a URL guarda a consulta (`?q=`).

### Login (`/entrar`)
- Login e senha, com troca obrigatória da senha inicial no primeiro acesso (`/nova-senha`) e logoff no pé do trilho.
- Tela no desenho do site da ScyQuantix, com o logo oficial e as cores da marca fixas, iguais nos temas claro e escuro.
- Botão de olho nos campos de senha, para conferir o que foi digitado.
- Medidor de força na senha nova: **Incompatível** quando o sistema recusaria a senha (com o motivo), e **Fraca**, **Razoável**, **Boa** ou **Forte** quando ela é aceita. As regras são as mesmas do servidor (`src/lib/regras-senha.ts`), e a comparação com a senha atual é feita no servidor enquanto se digita.
- Bloqueio do login por 15 minutos depois de 5 tentativas erradas seguidas.
- Usuários, sessões e registro de acessos em tabelas próprias, com senhas em hash scrypt e regras de RLS emuladas no SQLite. Cada pessoa só vê as próprias consultas salvas e o próprio histórico.
- Acessos mock do MVP: `leo` e `fabricio`, ambos com a senha inicial `scyscope@2026`.
- Detalhes, integração futura com o ScyHome e **o que rever antes do deploy**: [`docs/acesso.md`](docs/acesso.md).

### Catálogo (`/tabelas`)
- Cada fonte com o tamanho do banco, a data da última atualização e um link para a documentação oficial da API.
- Página de cada tabela (por exemplo, `/tabelas/tce.despesas`) com:
  - facetas por coluna para filtrar com um clique;
  - busca no texto e ordenação;
  - estatísticas por coluna (nulos, distintos, mínimo, máximo, média, valores mais frequentes);
  - "Abrir no editor", que gera o SQL equivalente aos filtros.

### Relatórios (`/anexos`)
- Qualquer anexo do RREO ou do RGF (de `siconfi.linhas`) remontado como a matriz do relatório oficial: contas nas linhas e colunas na ordem da API.
- Filtros de relatório, ano, período, anexo e conta, com link para o JSON original na API do Tesouro.

### Interface
- Tema claro (padrão) e escuro, na identidade visual ScyQuantix.
- Layout responsivo: trilho de navegação lateral no desktop, só ícones em telas médias e barra superior no celular.

## Fontes de dados

| Esquema | API | Tabelas | Como obter |
| --- | --- | --- | --- |
| `siconfi` | Tesouro Nacional, SICONFI | `linhas` (RREO e RGF linha a linha, 2022+), `entregas`, `coletas` | **Já vem no repositório**; atualize com `npm run sync -- siconfi` |
| `tce` | TCE-SP, Portal da Transparência Municipal | `despesas` (cada empenho, liquidação e pagamento, com fornecedor; 2024+), `receitas` (por fonte de recurso), `coletas` | `npm run sync -- tce` |
| `ibge` | IBGE, localidades e agregados | `municipios`, `populacao` (estimativas anuais e Censo 2022), `coletas` | `npm run sync -- ibge` |
| `bacen` | Banco Central, SGS | `series`, `valores` (IPCA, INPC, IGP-M, Selic), `ipca` (com número-índice para deflacionar), `coletas` | `npm run sync -- bacen` |

Conferência entre fontes: a despesa liquidada do TCE-SP bate com a do RREO no SICONFI com 0,00% de diferença em 2024, 2025 e 2026 (até agosto). A consulta está entre os exemplos.

## Rodando na sua máquina

### Pré-requisitos

- **Node.js 24 ou mais novo.** O app usa o `node:sqlite` embutido, sem dependências nativas para compilar. Confira com `node --version`.
- **Git.**
- Acesso à internet para a primeira sincronização (cerca de 3 minutos e 25 MB em disco).

Funciona em Linux, macOS e Windows (WSL ou PowerShell).

### Passo a passo

**1. Clone o repositório**

```bash
git clone https://github.com/scyquantix/scyscope.git
cd scyscope
```

**2. Instale as dependências**

```bash
npm install
```

**3. Baixe os dados públicos**

O banco do SICONFI (`data/fontes/siconfi.db`, cerca de 10 MB) já vem no repositório. Só com ele, o app já abre com a consulta SQL, o catálogo e os relatórios funcionando. Para as outras três fontes:

```bash
npm run sync
```

Isso cria um SQLite por fonte em `data/fontes/` (`tce.db`, `ibge.db`, `bacen.db`) e atualiza o `siconfi.db`. O TCE-SP é o mais demorado, porque baixa mês a mês desde 2024. A API do Censo do IBGE leva uns 35 s para responder; é normal parecer parado nesse ponto. Uma fonte que ainda não foi baixada aparece como "não sincronizado" na lateral.

Para atualizar só uma fonte ou um ano:

```bash
npm run sync -- ibge          # só o IBGE
npm run sync -- tce 2025      # só o TCE-SP de 2025
npm run sync -- siconfi 2026  # só o SICONFI de 2026
```

Cada execução substitui o lote numa transação e registra o resultado na tabela `coletas` da fonte. Rodar de novo é seguro.

> Atualizar o SICONFI modifica `data/fontes/siconfi.db`, que é versionado: o `git status` vai mostrá-lo alterado. Faça commit quando quiser publicar os dados novos.

**4. Inicie o servidor de desenvolvimento**

```bash
npm run dev
```

Abra **http://127.0.0.1:3100** e entre com `leo` ou `fabricio`, senha `scyscope@2026`. No primeiro acesso, o app pede uma senha nova. Depois disso, a tela de consulta já abre com o primeiro exemplo executado.

**5. (Opcional) Versão de produção**

```bash
npm run build
npm start        # também em http://127.0.0.1:3100
```

### Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento em `127.0.0.1:3100` |
| `npm run build` / `npm start` | Build e servidor de produção |
| `npm run sync [-- fonte] [ano]` | Baixa ou atualiza as fontes públicas |
| `npm run typecheck` | Verificação de tipos (`tsc --noEmit`) |

### Problemas comuns

- **"Nenhuma fonte sincronizada"**: rode `npm run sync` (passo 3).
- **`no such table: siconfi.linhas`**: o arquivo `data/fontes/siconfi.db` foi apagado. Restaure com `git checkout data/fontes/siconfi.db` ou baixe de novo com `npm run sync -- siconfi`.
- **Erro de `node:sqlite`**: a versão do Node é anterior à 24.
- **A porta 3100 está ocupada**: rode `npx next dev -H 127.0.0.1 -p 3200`.

## Segurança das consultas

- Cada fonte é anexada a uma conexão em memória como esquema somente leitura (`ATTACH 'file:…?mode=ro' AS tce`), antes de qualquer consulta do usuário.
- Depois disso, o autorizador do SQLite (`workers/autorizador.mjs`) nega tudo que não seja ler: escrita, `ATTACH`, `DETACH`, `VACUUM INTO`, `load_extension` e PRAGMAs de configuração.
- Só uma instrução por vez.
- Cada consulta roda numa worker thread com tempo limite de 15 s e devolve no máximo 5.000 linhas na tela.

## Organização do código

| Caminho | O que faz |
| --- | --- |
| `scripts/sync.mjs` | Ingestão de SICONFI, IBGE, BACEN e TCE-SP, com retentativas, substituição por lote numa transação e registro em `coletas` |
| `workers/anexar.mjs` | Abre a conexão e anexa cada fonte com o nome da API |
| `workers/consulta.mjs`, `workers/autorizador.mjs` | Execução isolada e regra de só-leitura |
| `src/lib/fontes.ts` | Catálogo: sigla, órgão, descrição e documentação de cada fonte e tabela |
| `src/lib/config.ts` | Onde fica o arquivo de cada fonte (`data/fontes/<fonte>.db`) e os limites de execução |
| `src/lib/esquema.ts` | Introspecção por esquema |
| `src/lib/exemplos.ts` | Consultas de exemplo, sempre com o esquema explícito |
| `src/lib/banco.ts` | Banco gravável (`data/explorer.db`): tabelas, RLS emulado (`usuario_atual()`, views e gatilhos) e usuários mock |
| `src/lib/acesso.ts`, `src/lib/senha.ts`, `src/lib/sessao.ts` | Login, sessões, bloqueio por tentativas, hash scrypt e `exigirUsuario()` |
| `src/lib/regras-senha.ts` | Regras da senha nova e cálculo da força, compartilhados pelo servidor e pelo medidor |
| `src/proxy.ts` | Redireciona para `/entrar` quem chega sem cookie de sessão |
| `src/app/` | Páginas (Next.js App Router): `(app)/` com consulta, catálogo, tabela e relatórios; `(acesso)/` com login e nova senha |
| `src/components/` | Editor, resultado (tabela, gráfico, plano), navegação, formulários de acesso e marca |
| `src/components/logo.tsx`, `logo-paths.ts` | Logo oficial da ScyQuantix, copiado do `packages/ui` do ScyHome |

Stack: Next.js 16, React 19, TypeScript e SQLite via `node:sqlite`. Não usa nenhuma outra dependência de execução.

## Plano de deploy

Nada desta seção está implementado ainda. O projeto completo está em [`docs/deploy.md`](docs/deploy.md) e o roteiro, etapa por etapa, em [`docs/mvp-passo-a-passo.md`](docs/mvp-passo-a-passo.md).

**Fluxo:** Codespaces → GitHub → GitHub Actions com PySpark → Cloudflare R2 → Supabase (Postgres) → Vercel → Cloudflare DNS.

| Peça | Papel |
| --- | --- |
| GitHub Actions + PySpark | Coleta das APIs e transformação em camadas bronze, silver e gold, com cargas agendadas |
| Cloudflare R2 | Data lake em Parquet e arquivos CSV exportados, entregues por URL assinada |
| Supabase | Postgres com um schema por fonte (os nomes `tce.despesas` etc. não mudam), papel só de leitura e registro anônimo das consultas para análise |
| Vercel | O app Next.js, na região `gru1` |
| Cloudflare DNS | Subdomínio, por exemplo `scope.scyquantix.com` |

**Escopo em duas versões:**
- **A, o MVP:** só Ferraz de Vasconcelos, toda nos planos gratuitos (US$ 0 por mês).
- **B, depois:** o estado de São Paulo inteiro. Começa gratuita, com o detalhe só no R2 e marts agregados no Supabase. Passa a planos pagos (cerca de US$ 60 a 105 por mês) quando o uso justificar.

**Roteiro da versão A:**

| Etapa | O quê | Esforço |
| --- | --- | --- |
| 0 | Contas e serviços (GitHub, Supabase, R2, Vercel) | ½ dia |
| 1 | Codespaces e CI | ½ dia |
| 2 | Banco no Supabase | 1 dia |
| 3 | Pipeline de dados | 3 a 5 dias |
| 4 | App em Postgres (SQLite → Postgres, dialeto, plano de execução) | 3 a 5 dias |
| 5 | Publicação na Vercel | ½ dia |
| 6 | Domínio | 1 hora mais a propagação |
| 7 | Operação | ½ dia |
| 8 | Limpeza (saem `scripts/sync.mjs`, `workers/` e o `siconfi.db`) | ½ dia |

**Login no deploy:** o login local **tem de ser revisto antes de publicar**. O caminho previsto é usar a autenticação do ScyHome (Supabase Auth), com `usuarios.id` (UUID) como chave e RLS nativo no Postgres. A lista do que muda está na seção 6 de [`docs/acesso.md`](docs/acesso.md).

**Decisões em aberto:** login no deploy, subdomínio, ambiente de homologação, downloads públicos ou por URL assinada na versão B e o sinal de uso que justifica os planos pagos (seção 13 de [`docs/deploy.md`](docs/deploy.md)).

## Limitações do MVP

- Só Ferraz de Vasconcelos. Trocar de município hoje é editar `MUNICIPIO` em `scripts/sync.mjs` e `ENTE` em `src/app/(app)/anexos/page.tsx`.
- O IBGE não tem estimativa de população para 2023. Em 2022 vale o Censo.
- Setembro e outubro de 2026 ainda vêm vazios na API do TCE-SP.
- O login é local e serve só para rodar em `127.0.0.1`. Antes de publicar, ele precisa ser revisto (seção 6 de [`docs/acesso.md`](docs/acesso.md)).
- Nomes sem esquema (`FROM linhas`) continuam funcionando, porque o SQLite procura nas fontes. Os exemplos usam sempre o nome qualificado.

---

ScyQuantix · Tecnologia orientada por evidências · [scyquantix.com](https://scyquantix.com)
