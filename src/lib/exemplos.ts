// Consultas prontas. Cada tabela leva o esquema da API de origem (siconfi., tce., ibge., bacen.),
// para que fique claro de onde vem cada número; as últimas cruzam fontes.

import type { IdFonte } from "./fontes";

export type Exemplo = { id: string; titulo: string; descricao: string; fontes: IdFonte[]; sql: string };

export const EXEMPLOS: Exemplo[] = [
  {
    id: "relatorios",
    titulo: "Relatórios na base",
    descricao: "Cada RREO e RGF baixado do SICONFI, com quantos anexos e linhas vieram.",
    fontes: ["siconfi"],
    sql: `SELECT fonte, exercicio, periodo,
       COUNT(DISTINCT anexo) AS anexos,
       COUNT(*) AS linhas
FROM siconfi.linhas
GROUP BY fonte, exercicio, periodo
ORDER BY exercicio DESC, fonte, periodo DESC;`,
  },
  {
    id: "per-capita-real",
    titulo: "Receita per capita, em reais de hoje",
    descricao: "SICONFI (receita do ano) ÷ IBGE (população) e corrigida pelo IPCA do BACEN.",
    fontes: ["siconfi", "ibge", "bacen"],
    sql: `WITH receita AS (
  -- Receita realizada no 6º bimestre (ano fechado) do RREO Anexo 14
  SELECT exercicio AS ano, valor AS realizada
  FROM siconfi.linhas
  WHERE fonte = 'RREO' AND anexo = 'RREO-Anexo 14' AND periodo = 6
    AND conta = 'Receitas Realizadas' AND coluna = 'Até o Bimestre'
),
pop AS (
  -- Estimativa do ano; em 2022, o Censo
  SELECT ano, MAX(CASE WHEN tipo = 'censo' THEN populacao END) AS censo,
         MAX(CASE WHEN tipo = 'estimativa' THEN populacao END) AS estimativa
  FROM ibge.populacao GROUP BY ano
),
ipca AS (
  SELECT substr(mes, 1, 4) AS ano, indice FROM bacen.ipca WHERE mes LIKE '%-12'
)
SELECT r.ano,
       ROUND(r.realizada / 1e6, 1) AS receita_mi,
       COALESCE(p.censo, p.estimativa) AS populacao,
       ROUND(r.realizada / COALESCE(p.censo, p.estimativa), 2) AS per_capita,
       ROUND(r.realizada / COALESCE(p.censo, p.estimativa)
             * (SELECT indice FROM bacen.ipca ORDER BY mes DESC LIMIT 1) / i.indice, 2) AS per_capita_hoje
FROM receita r
JOIN pop p ON p.ano = r.ano
JOIN ipca i ON i.ano = CAST(r.ano AS TEXT)
ORDER BY r.ano;`,
  },
  {
    id: "tce-x-siconfi",
    titulo: "Conferência TCE-SP × SICONFI",
    descricao: "Despesa liquidada no ano segundo o TCE (lançamento a lançamento) e segundo o RREO.",
    fontes: ["tce", "siconfi"],
    sql: `WITH tce AS (
  SELECT exercicio, SUM(valor) AS liquidado
  FROM tce.despesas
  WHERE evento = 'Valor Liquidado'
  GROUP BY exercicio
),
rreo AS (
  -- Último bimestre entregue de cada ano
  SELECT exercicio, periodo, valor AS liquidado
  FROM siconfi.linhas l
  WHERE fonte = 'RREO' AND anexo = 'RREO-Anexo 14' AND conta = 'Despesas Liquidadas' AND coluna = 'Até o Bimestre'
    AND periodo = (SELECT MAX(periodo) FROM siconfi.linhas WHERE fonte = 'RREO' AND exercicio = l.exercicio)
  GROUP BY exercicio
)
SELECT t.exercicio, r.periodo AS bimestre_rreo,
       ROUND(t.liquidado / 1e6, 1) AS tce_mi,
       ROUND(r.liquidado / 1e6, 1) AS siconfi_mi,
       ROUND(100.0 * (t.liquidado - r.liquidado) / r.liquidado, 2) AS diferenca_pct
FROM tce t JOIN rreo r USING (exercicio)
ORDER BY t.exercicio;`,
  },
  {
    id: "fornecedores",
    titulo: "Maiores fornecedores pagos",
    descricao: "TCE-SP: soma dos pagamentos por fornecedor no ano mais recente fechado.",
    fontes: ["tce"],
    sql: `SELECT fornecedor, tipo_fornecedor,
       COUNT(DISTINCT nr_empenho) AS empenhos,
       ROUND(SUM(valor) / 1e6, 2) AS pago_mi
FROM tce.despesas
WHERE evento = 'Valor Pago' AND exercicio = 2025
GROUP BY fornecedor, tipo_fornecedor
ORDER BY SUM(valor) DESC
LIMIT 20;`,
  },
  {
    id: "pagamentos-mes",
    titulo: "Pagamentos por mês",
    descricao: "TCE-SP: valor pago a cada mês, por ano, para ver a sazonalidade.",
    fontes: ["tce"],
    sql: `SELECT mes,
       ROUND(SUM(CASE WHEN exercicio = 2024 THEN valor END) / 1e6, 1) AS pago_2024_mi,
       ROUND(SUM(CASE WHEN exercicio = 2025 THEN valor END) / 1e6, 1) AS pago_2025_mi,
       ROUND(SUM(CASE WHEN exercicio = 2026 THEN valor END) / 1e6, 1) AS pago_2026_mi
FROM tce.despesas
WHERE evento = 'Valor Pago'
GROUP BY mes
ORDER BY mes;`,
  },
  {
    id: "pessoal",
    titulo: "Despesa com pessoal por quadrimestre",
    descricao: "SICONFI, RGF Anexo 01: % da RCL ajustada, com os limites de alerta e máximo.",
    fontes: ["siconfi"],
    sql: `SELECT exercicio, periodo AS quadrimestre,
       MAX(CASE WHEN cod_conta = 'DespesaComPessoalTotal' THEN valor END) AS pessoal_pct,
       MAX(CASE WHEN cod_conta = 'LimiteDeAlertaDespesaComPessoalTotal' THEN valor END) AS alerta,
       MAX(CASE WHEN cod_conta = 'LimiteMaximoDespesaComPessoalTotal' THEN valor END) AS limite
FROM siconfi.linhas
WHERE fonte = 'RGF' AND anexo = 'RGF-Anexo 01' AND coluna = '% sobre a RCL Ajustada'
GROUP BY exercicio, periodo
ORDER BY exercicio, periodo;`,
  },
  {
    id: "ipca-12m",
    titulo: "Inflação acumulada em 12 meses",
    descricao: "BACEN: IPCA, INPC e IGP-M acumulados nos 12 meses até cada mês.",
    fontes: ["bacen"],
    sql: `WITH m AS (
  SELECT substr(data, 1, 7) AS mes,
         MAX(CASE WHEN codigo = 433 THEN valor END) AS ipca,
         MAX(CASE WHEN codigo = 188 THEN valor END) AS inpc,
         MAX(CASE WHEN codigo = 189 THEN valor END) AS igpm
  FROM bacen.valores WHERE codigo IN (433, 188, 189)
  GROUP BY 1
)
-- Acumulado = produto de (1 + taxa) nos últimos 12 meses, via soma de logaritmos
SELECT mes,
       ROUND(100 * (exp(SUM(ln(1 + ipca / 100)) OVER doze) - 1), 2) AS ipca_12m,
       ROUND(100 * (exp(SUM(ln(1 + inpc / 100)) OVER doze) - 1), 2) AS inpc_12m,
       ROUND(100 * (exp(SUM(ln(1 + igpm / 100)) OVER doze) - 1), 2) AS igpm_12m
FROM m
WINDOW doze AS (ORDER BY mes ROWS 11 PRECEDING)
ORDER BY mes DESC
LIMIT 24;`,
  },
  {
    id: "populacao",
    titulo: "População: estimativas e Censo",
    descricao: "IBGE: a série de estimativas e o Censo 2022, lado a lado.",
    fontes: ["ibge"],
    sql: `SELECT ano,
       MAX(CASE WHEN tipo = 'estimativa' THEN populacao END) AS estimativa,
       MAX(CASE WHEN tipo = 'censo' THEN populacao END) AS censo
FROM ibge.populacao
GROUP BY ano
ORDER BY ano DESC;`,
  },
  {
    id: "prazos",
    titulo: "Entregas do RREO e dias de atraso",
    descricao: "SICONFI: prazo de 30 dias após o fim do bimestre (LRF, art. 52).",
    fontes: ["siconfi"],
    sql: `SELECT exercicio, periodo AS bimestre,
       date(data_status) AS entregue_em,
       date(printf('%d-%02d-01', exercicio, periodo * 2), '+1 month', '-1 day', '+30 days') AS prazo,
       CAST(julianday(date(data_status)) - julianday(date(printf('%d-%02d-01', exercicio, periodo * 2), '+1 month', '-1 day', '+30 days')) AS INTEGER) AS dias_de_atraso
FROM siconfi.entregas
WHERE entregavel LIKE 'Relatório Resumido%' AND instituicao LIKE 'Prefeitura%'
ORDER BY exercicio DESC, periodo DESC;`,
  },
  {
    id: "minimos",
    titulo: "Mínimos de educação e saúde informados",
    descricao: "SICONFI, RREO Anexo 14. Períodos sem nenhuma informação não aparecem.",
    fontes: ["siconfi"],
    sql: `SELECT exercicio, periodo AS bimestre,
       MAX(CASE WHEN conta LIKE 'Mínimo Anual de <18%' THEN valor END) AS educacao_mde,
       MAX(CASE WHEN conta LIKE 'Mínimo Anual de 70%' THEN valor END) AS fundeb,
       MAX(CASE WHEN conta LIKE 'Despesas com Ações e Serviços Públicos de Saúde%' THEN valor END) AS saude_asps
FROM siconfi.linhas
WHERE fonte = 'RREO' AND anexo = 'RREO-Anexo 14' AND coluna = '% Aplicado Até o Bimestre'
GROUP BY exercicio, periodo
ORDER BY exercicio, periodo;`,
  },
];
