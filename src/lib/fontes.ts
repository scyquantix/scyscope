// Catálogo das fontes: cada API pública vira um esquema SQL com o próprio nome (siconfi.linhas, bacen.ipca…).
// Sem dependência de servidor: a interface usa estes textos para explicar de onde vem cada tabela.

export type IdFonte = "siconfi" | "tce" | "ibge" | "bacen";

export type Fonte = { id: IdFonte; sigla: string; orgao: string; resumo: string; documentacao: string; sincronizar: string };

export const FONTES: Fonte[] = [
  {
    id: "siconfi", sigla: "SICONFI", orgao: "Tesouro Nacional",
    resumo: "Relatórios fiscais que o município entrega: RREO (bimestral) e RGF (quadrimestral), linha a linha.",
    documentacao: "https://apidatalake.tesouro.gov.br/docs/siconfi/",
    sincronizar: "npm run sync -- siconfi",
  },
  {
    id: "tce", sigla: "TCE-SP", orgao: "Tribunal de Contas do Estado de São Paulo",
    resumo: "Execução detalhada: cada empenho, liquidação e pagamento com o fornecedor, e a receita por fonte de recurso.",
    documentacao: "https://transparencia.tce.sp.gov.br/",
    sincronizar: "npm run sync -- tce",
  },
  {
    id: "ibge", sigla: "IBGE", orgao: "Instituto Brasileiro de Geografia e Estatística",
    resumo: "Dados do município e população (estimativas anuais e Censo 2022), para valores per capita.",
    documentacao: "https://servicodados.ibge.gov.br/api/docs",
    sincronizar: "npm run sync -- ibge",
  },
  {
    id: "bacen", sigla: "BACEN", orgao: "Banco Central do Brasil · SGS",
    resumo: "Índices de preços e juros (IPCA, INPC, IGP-M, Selic), para corrigir valores pela inflação.",
    documentacao: "https://dadosabertos.bcb.gov.br/",
    sincronizar: "npm run sync -- bacen",
  },
];

export const fonte = (id: string) => FONTES.find((f) => f.id === id);

/** O que cada tabela guarda, em uma frase. Chave: esquema.tabela */
export const DESCRICOES: Record<string, string> = {
  "siconfi.linhas": "Cada valor de cada anexo do RREO e do RGF: relatório, período, anexo, conta, coluna e valor.",
  "siconfi.entregas": "Extrato de entregas: quando cada relatório foi enviado ao SICONFI, pela prefeitura e pela câmara.",
  "siconfi.coletas": "Registro das coletas na API do SICONFI.",
  "tce.despesas": "Um lançamento por evento (empenho, liquidação, pagamento, anulação), com fornecedor, data e valor.",
  "tce.receitas": "Receita arrecadada no mês por fonte de recurso, aplicação e alínea.",
  "tce.coletas": "Registro das coletas mensais na API do TCE-SP.",
  "ibge.municipios": "O município e suas regiões (UF, meso e microrregião, regiões imediata e intermediária).",
  "ibge.populacao": "População por ano: estimativas (agregado 6579) e o Censo 2022 (agregado 4709).",
  "ibge.coletas": "Registro das coletas na API do IBGE.",
  "bacen.series": "As séries do SGS baixadas, com unidade e periodicidade.",
  "bacen.valores": "Os valores de cada série por data (data no formato AAAA-MM-DD).",
  "bacen.ipca": "IPCA mensal com número-índice acumulado (dez/2014 = 100), pronto para deflacionar valores.",
  "bacen.coletas": "Registro das coletas na API do Banco Central.",
};
