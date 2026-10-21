# ScyScope

**Explore dados públicos do Brasil com SQL.** Um produto [ScyQuantix](https://scyquantix.com), "Tecnologia orientada por evidências", da família Scy Scope · Scy Pivot · Scy Canvas.

O ScyScope baixa dados de APIs públicas para bancos SQLite locais e deixa você consultá-los com SQL, cruzando fontes. Cada API é um esquema com o próprio nome, então toda consulta diz de onde vem cada número:

```sql
SELECT p.ano, p.populacao, i.indice
FROM ibge.populacao p
JOIN bacen.ipca i ON i.mes = p.ano || '-12';
```

> **Estado:** MVP em desenvolvimento, com um município, Ferraz de Vasconcelos (SP), código IBGE 3515707.

## Funcionalidades

### Consulta SQL (`/`)
- Editor com destaque de sintaxe, numeração de linhas e atalhos: `Ctrl+Enter` executa (só a seleção, se houver) e `Ctrl+S` salva.
- Lateral com o esquema agrupado por fonte. Cada tabela mostra o órgão, uma descrição, a contagem de linhas e as colunas com o tipo, e um clique insere o nome no editor.
- Dez consultas de exemplo, etiquetadas com as fontes que usam. Várias cruzam esquemas, como receita per capita corrigida pelo IPCA e a conferência entre TCE-SP e SICONFI.
- Consultas salvas e histórico das execuções, guardados em `data/explorer.db`.
- Resultado em três abas: **tabela** (ordenável, com números formatados), **gráfico** (barras ou linhas, com escolha das séries) e **plano de execução** (`EXPLAIN QUERY PLAN`, com varreduras completas destacadas).
- Exportação CSV de até 200 mil linhas, cópia do resultado e link compartilhável: a URL guarda a consulta (`?q=`).

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

Abra **http://127.0.0.1:3100**. A tela inicial já abre com o primeiro exemplo executado.

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
| `src/app/` | Páginas (Next.js App Router): consulta, catálogo, tabela e relatórios |
| `src/components/` | Editor, resultado (tabela, gráfico, plano), navegação e marca |

Stack: Next.js 16, React 19, TypeScript e SQLite via `node:sqlite`. Não usa nenhuma outra dependência de execução.

## Limitações do MVP

- Só Ferraz de Vasconcelos. Trocar de município hoje é editar `MUNICIPIO` em `scripts/sync.mjs` e `ENTE` em `src/app/anexos/page.tsx`.
- O IBGE não tem estimativa de população para 2023. Em 2022 vale o Censo.
- Setembro e outubro de 2026 ainda vêm vazios na API do TCE-SP.
- Nomes sem esquema (`FROM linhas`) continuam funcionando, porque o SQLite procura nas fontes. Os exemplos usam sempre o nome qualificado.

---

ScyQuantix · Tecnologia orientada por evidências · [scyquantix.com](https://scyquantix.com)
