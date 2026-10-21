// Baixa as fontes do ScyScope para um SQLite por API, em data/fontes/<fonte>.db.
//
//   npm run sync                  todas as fontes
//   npm run sync -- tce           só uma
//   npm run sync -- tce 2025      TCE-SP de um ano só (vale também para o siconfi)
//
// O siconfi.db fica no git para o app funcionar logo após o clone; os demais são gerados aqui.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MUNICIPIO = { ibge: 3515707, tce: "ferraz-de-vasconcelos", nome: "Ferraz de Vasconcelos" };
const PASTA = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "fontes");
// Só ASCII: o IBGE recusa (HTTP 400) cabeçalhos com acento
const AGENTE = "ScyScope/0.1 (estudo; dados publicos de Ferraz de Vasconcelos)";
mkdirSync(PASTA, { recursive: true });

const args = process.argv.slice(2);
const fontes = args.filter((a) => ["siconfi", "ibge", "bacen", "tce"].includes(a));
const anosPedidos = args.map(Number).filter((n) => n > 2000);
const alvo = fontes.length ? fontes : ["siconfi", "ibge", "bacen", "tce"];
const anoAtual = new Date().getFullYear();

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(url, tentativas = 4) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": AGENTE, Accept: "application/json" }, signal: AbortSignal.timeout(120_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      if (t === tentativas) throw e;
      await espera(1500 * 2 ** t);
    }
  }
}

function abrir(fonte, ddl) {
  const db = new DatabaseSync(join(PASTA, `${fonte}.db`));
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS coletas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, inicio TEXT NOT NULL, fim TEXT, recurso TEXT NOT NULL,
      linhas INTEGER, status TEXT NOT NULL, mensagem TEXT
    );
    ${ddl}`);
  return db;
}

/** Substitui um lote numa transação e registra a coleta; um erro não derruba as demais. */
async function lote(db, recurso, apagar, baixar) {
  const inicio = new Date().toISOString();
  try {
    const linhas = await baixar();
    db.exec("BEGIN");
    apagar();
    linhas.forEach((ins) => ins());
    db.exec("COMMIT");
    db.prepare("INSERT INTO coletas (inicio, fim, recurso, linhas, status) VALUES (?, ?, ?, ?, ?)").run(inicio, new Date().toISOString(), recurso, linhas.length, linhas.length ? "ok" : "vazio");
    return linhas.length;
  } catch (e) {
    if (db.isTransaction) db.exec("ROLLBACK");
    db.prepare("INSERT INTO coletas (inicio, fim, recurso, status, mensagem) VALUES (?, ?, ?, 'erro', ?)").run(inicio, new Date().toISOString(), recurso, String(e.message ?? e));
    console.error(`  ${recurso}: erro (${e.message ?? e})`);
    return null;
  }
}

// ---------- SICONFI: RREO, RGF e extrato de entregas ----------

const SICONFI = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";

/** Itens de um recurso do SICONFI, seguindo a paginação (hasMore) da API. */
async function siconfiItens(caminho, params) {
  const itens = [];
  for (let offset = 0; ; offset += 5000) {
    const r = await json(`${SICONFI}/${caminho}?${new URLSearchParams({ ...params, offset, limit: 5000 })}`);
    itens.push(...r.items);
    if (!r.hasMore) return itens;
  }
}

async function siconfi() {
  // Sem WAL: o arquivo vai para o git e precisa abrir sozinho, sem -wal e -shm ao lado.
  // A tabela coletas mantém o formato do painel-local (fonte, exercício, período), de onde a base veio.
  const db = new DatabaseSync(join(PASTA, "siconfi.db"));
  db.exec(`PRAGMA journal_mode = DELETE;
    CREATE TABLE IF NOT EXISTS linhas (
      fonte TEXT NOT NULL,          -- RREO ou RGF
      exercicio INTEGER NOT NULL,
      periodo INTEGER NOT NULL,     -- bimestre (RREO) ou quadrimestre (RGF)
      anexo TEXT NOT NULL, rotulo TEXT, cod_conta TEXT NOT NULL, conta TEXT NOT NULL,
      coluna TEXT NOT NULL, valor REAL, populacao INTEGER
    );
    CREATE INDEX IF NOT EXISTS linhas_busca ON linhas (fonte, exercicio, periodo, anexo, cod_conta);
    CREATE TABLE IF NOT EXISTS entregas (
      exercicio INTEGER NOT NULL, periodo INTEGER NOT NULL, periodicidade TEXT NOT NULL, entregavel TEXT NOT NULL,
      data_status TEXT, status_relatorio TEXT, forma_envio TEXT, tipo_relatorio TEXT, instituicao TEXT
    );
    CREATE TABLE IF NOT EXISTS coletas (
      id INTEGER PRIMARY KEY AUTOINCREMENT, inicio TEXT NOT NULL, fim TEXT, fonte TEXT NOT NULL,
      exercicio INTEGER NOT NULL, periodo INTEGER, linhas INTEGER,
      status TEXT NOT NULL,         -- ok, vazio (ainda não entregue) ou erro
      mensagem TEXT
    );`);
  const registrar = db.prepare("INSERT INTO coletas (inicio, fim, fonte, exercicio, periodo, linhas, status, mensagem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  const insL = db.prepare("INSERT INTO linhas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insE = db.prepare("INSERT INTO entregas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");

  /** Substitui um relatório (ou o extrato de um ano) numa transação; um erro fica registrado e não para o resto. */
  const coletar = async (fonte, ano, periodo, apagar, baixar) => {
    const inicio = new Date().toISOString();
    try {
      const itens = await baixar();
      db.exec("BEGIN");
      apagar();
      itens.forEach((ins) => ins());
      db.exec("COMMIT");
      registrar.run(inicio, new Date().toISOString(), fonte, ano, periodo, itens.length, itens.length ? "ok" : "vazio", null);
      return itens.length;
    } catch (e) {
      if (db.isTransaction) db.exec("ROLLBACK");
      registrar.run(inicio, new Date().toISOString(), fonte, ano, periodo, null, "erro", String(e.message ?? e));
      console.error(`  siconfi ${fonte} ${ano}/${periodo ?? "-"}: erro (${e.message ?? e})`);
      return null;
    }
  };
  const relatorio = (fonte, ano, periodo, params) =>
    coletar(fonte, ano, periodo, () => db.prepare("DELETE FROM linhas WHERE fonte = ? AND exercicio = ? AND periodo = ?").run(fonte, ano, periodo), async () =>
      (await siconfiItens(fonte.toLowerCase(), params)).map((i) => () =>
        insL.run(fonte, ano, periodo, i.anexo, i.rotulo ?? null, i.cod_conta, i.conta, i.coluna, i.valor ?? null, i.populacao ?? null)));

  const ente = MUNICIPIO.ibge;
  const anos = anosPedidos.length ? anosPedidos : Array.from({ length: anoAtual - 2022 + 1 }, (_, i) => 2022 + i);
  for (const ano of anos) {
    // O extrato de entregas diz o que já foi enviado; só se baixa o que foi entregue
    await coletar("ENTREGAS", ano, null, () => db.prepare("DELETE FROM entregas WHERE exercicio = ?").run(ano), async () =>
      (await siconfiItens("extrato_entregas", { id_ente: ente, an_referencia: ano })).map((e) => () =>
        insE.run(ano, e.periodo, e.periodicidade, e.entregavel, e.data_status, e.status_relatorio, e.forma_envio, e.tipo_relatorio, e.instituicao)));
    const entregue = (entregavel, periodo) => db.prepare("SELECT 1 FROM entregas WHERE exercicio = ? AND periodo = ? AND entregavel = ? LIMIT 1").get(ano, periodo, entregavel);
    const partes = [];
    for (let b = 1; b <= 6; b++) {
      if (!entregue("Relatório Resumido de Execução Orçamentária", b)) continue;
      const n = await relatorio("RREO", ano, b, { an_exercicio: ano, nr_periodo: b, co_tipo_demonstrativo: "RREO", id_ente: ente });
      partes.push(`RREO b${b}: ${n ?? "erro"}`);
    }
    for (let q = 1; q <= 3; q++) {
      if (!entregue("Relatório de Gestão Fiscal", q)) continue;
      const n = await relatorio("RGF", ano, q, { an_exercicio: ano, in_periodicidade: "Q", nr_periodo: q, co_tipo_demonstrativo: "RGF", co_poder: "E", id_ente: ente });
      partes.push(`RGF q${q}: ${n ?? "erro"}`);
    }
    console.log(`siconfi ${ano}: ${partes.join(" · ") || "nenhum relatório entregue"}`);
  }
  db.close();
}

// ---------- IBGE: localidade e população ----------

async function ibge() {
  const db = abrir("ibge", `
    CREATE TABLE IF NOT EXISTS municipios (
      cod_ibge INTEGER PRIMARY KEY, nome TEXT NOT NULL, uf TEXT NOT NULL, regiao TEXT,
      mesorregiao TEXT, microrregiao TEXT, regiao_intermediaria TEXT, regiao_imediata TEXT
    );
    CREATE TABLE IF NOT EXISTS populacao (
      cod_ibge INTEGER NOT NULL, ano INTEGER NOT NULL, populacao INTEGER NOT NULL,
      tipo TEXT NOT NULL,            -- estimativa (agregado 6579) ou censo (agregado 4709)
      agregado INTEGER NOT NULL, PRIMARY KEY (cod_ibge, ano, tipo)
    );`);
  const m = MUNICIPIO.ibge;
  const n1 = await lote(db, "municipios", () => db.prepare("DELETE FROM municipios WHERE cod_ibge = ?").run(m), async () => {
    const l = await json(`https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${m}`);
    const meso = l.microrregiao?.mesorregiao, ri = l["regiao-imediata"];
    return [() => db.prepare("INSERT INTO municipios VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      l.id, l.nome, meso?.UF?.sigla ?? null, meso?.UF?.regiao?.nome ?? null, meso?.nome ?? null, l.microrregiao?.nome ?? null,
      ri?.["regiao-intermediaria"]?.nome ?? null, ri?.nome ?? null)];
  });
  const serie = async (agregado, variavel, periodos, tipo) => {
    const r = await json(`https://servicodados.ibge.gov.br/api/v3/agregados/${agregado}/periodos/${periodos}/variaveis/${variavel}?localidades=N6%5B${m}%5D`);
    const valores = r[0]?.resultados?.[0]?.series?.[0]?.serie ?? {};
    return Object.entries(valores)
      .filter(([, v]) => /^\d+$/.test(v))
      .map(([ano, v]) => () => db.prepare("INSERT INTO populacao VALUES (?, ?, ?, ?, ?)").run(m, Number(ano), Number(v), tipo, agregado));
  };
  const anos = Array.from({ length: anoAtual - 2001 + 1 }, (_, i) => 2001 + i).join("|");
  const n2 = await lote(db, "populacao estimada", () => db.prepare("DELETE FROM populacao WHERE cod_ibge = ? AND tipo = 'estimativa'").run(m), () => serie(6579, 9324, anos, "estimativa"));
  const n3 = await lote(db, "censo 2022", () => db.prepare("DELETE FROM populacao WHERE cod_ibge = ? AND tipo = 'censo'").run(m), () => serie(4709, 93, "2022", "censo"));
  console.log(`ibge   municípios ${n1} · estimativas ${n2} · censo ${n3}`);
  db.close();
}

// ---------- BACEN: séries do SGS ----------

const SERIES = [
  { codigo: 433, nome: "IPCA", descricao: "Variação mensal do IPCA (IBGE)", unidade: "% a.m.", periodicidade: "mensal" },
  { codigo: 188, nome: "INPC", descricao: "Variação mensal do INPC (IBGE)", unidade: "% a.m.", periodicidade: "mensal" },
  { codigo: 189, nome: "IGP-M", descricao: "Variação mensal do IGP-M (FGV)", unidade: "% a.m.", periodicidade: "mensal" },
  { codigo: 432, nome: "Selic meta", descricao: "Meta da taxa Selic definida pelo Copom", unidade: "% a.a.", periodicidade: "diária" },
];

async function bacen() {
  const db = abrir("bacen", `
    CREATE TABLE IF NOT EXISTS series (codigo INTEGER PRIMARY KEY, nome TEXT NOT NULL, descricao TEXT, unidade TEXT, periodicidade TEXT);
    CREATE TABLE IF NOT EXISTS valores (codigo INTEGER NOT NULL, data TEXT NOT NULL, valor REAL NOT NULL, PRIMARY KEY (codigo, data));
    -- IPCA mensal com número-índice acumulado (dez/2014 = 100), para corrigir valores pela inflação
    CREATE TABLE IF NOT EXISTS ipca (mes TEXT PRIMARY KEY, variacao_pct REAL NOT NULL, indice REAL NOT NULL);`);
  const partes = [];
  for (const s of SERIES) {
    const n = await lote(db, `sgs ${s.codigo} ${s.nome}`, () => { db.prepare("DELETE FROM valores WHERE codigo = ?").run(s.codigo); db.prepare("DELETE FROM series WHERE codigo = ?").run(s.codigo); }, async () => {
      // Séries diárias aceitam no máximo 10 anos por pedido (HTTP 406 acima disso)
      const inicio = s.periodicidade === "diária" ? new Date(Date.now() - (10 * 365 - 3) * 864e5).toLocaleDateString("pt-BR") : "01/01/2015";
      const dados = await json(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${s.codigo}/dados?formato=json&dataInicial=${inicio}`);
      const iso = (d) => d.split("/").reverse().join("-");
      return [
        () => db.prepare("INSERT INTO series VALUES (?, ?, ?, ?, ?)").run(s.codigo, s.nome, s.descricao, s.unidade, s.periodicidade),
        ...dados.map((d) => () => db.prepare("INSERT OR REPLACE INTO valores VALUES (?, ?, ?)").run(s.codigo, iso(d.data), Number(d.valor))),
      ];
    });
    partes.push(`${s.nome} ${n == null ? "erro" : n - 1}`);
  }
  // Número-índice do IPCA a partir da série 433
  const ipca = db.prepare("SELECT substr(data, 1, 7) mes, valor FROM valores WHERE codigo = 433 ORDER BY data").all();
  db.exec("BEGIN"); db.exec("DELETE FROM ipca");
  let indice = 100;
  for (const r of ipca) { indice *= 1 + r.valor / 100; db.prepare("INSERT INTO ipca VALUES (?, ?, ?)").run(r.mes, r.valor, Math.round(indice * 1e6) / 1e6); }
  db.exec("COMMIT");
  console.log(`bacen  ${partes.join(" · ")} · índice IPCA ${ipca.length} meses`);
  db.close();
}

// ---------- TCE-SP: despesas e receitas mensais ----------

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const reais = (v) => (v == null || v === "" ? null : Number(String(v).replace(/\./g, "").replace(",", ".")));
const data = (d) => (d && /^\d{2}\/\d{2}\/\d{4}$/.test(d) ? d.split("/").reverse().join("-") : d || null);

async function tce() {
  const db = abrir("tce", `
    CREATE TABLE IF NOT EXISTS despesas (
      exercicio INTEGER NOT NULL, mes INTEGER NOT NULL, orgao TEXT, evento TEXT NOT NULL,
      nr_empenho TEXT, tipo_fornecedor TEXT, documento_fornecedor TEXT, fornecedor TEXT,
      data_emissao TEXT, valor REAL
    );
    CREATE INDEX IF NOT EXISTS despesas_periodo ON despesas (exercicio, mes, evento);
    CREATE INDEX IF NOT EXISTS despesas_fornecedor ON despesas (fornecedor);
    CREATE TABLE IF NOT EXISTS receitas (
      exercicio INTEGER NOT NULL, mes INTEGER NOT NULL, orgao TEXT, fonte_recurso TEXT,
      aplicacao TEXT, alinea TEXT, subalinea TEXT, valor REAL
    );
    CREATE INDEX IF NOT EXISTS receitas_periodo ON receitas (exercicio, mes);`);
  const anos = anosPedidos.length ? anosPedidos : [anoAtual - 2, anoAtual - 1, anoAtual];
  const insD = db.prepare("INSERT INTO despesas VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  const insR = db.prepare("INSERT INTO receitas VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  for (const ano of anos) {
    let nd = 0, nr = 0, vazios = 0;
    for (let mes = 1; mes <= 12; mes++) {
      if (ano === anoAtual && mes > new Date().getMonth() + 1) break;
      const base = `https://transparencia.tce.sp.gov.br/api/json`;
      const d = await lote(db, `despesas ${ano}/${mes}`, () => db.prepare("DELETE FROM despesas WHERE exercicio = ? AND mes = ?").run(ano, mes), async () => {
        const itens = await json(`${base}/despesas/${MUNICIPIO.tce}/${ano}/${mes}`);
        return (Array.isArray(itens) ? itens : []).map((i) => () => {
          // "CNPJ - PESSOA JURÍDICA - 46523197000144" → tipo e documento; outros formatos ficam como vieram
          const partes = String(i.id_fornecedor ?? "").split(" - ");
          const [tipo, doc] = partes.length >= 3 ? [partes[1], partes.slice(2).join(" - ")] : [null, i.id_fornecedor ?? null];
          insD.run(ano, mes, i.orgao, i.evento, i.nr_empenho, tipo, doc, i.nm_fornecedor, data(i.dt_emissao_despesa), reais(i.vl_despesa));
        });
      });
      const r = await lote(db, `receitas ${ano}/${mes}`, () => db.prepare("DELETE FROM receitas WHERE exercicio = ? AND mes = ?").run(ano, mes), async () => {
        const itens = await json(`${base}/receitas/${MUNICIPIO.tce}/${ano}/${mes}`);
        return (Array.isArray(itens) ? itens : []).map((i) => () => insR.run(ano, mes, i.orgao, i.ds_fonte_recurso, i.ds_cd_aplicacao_fixo, i.ds_alinea, i.ds_subalinea || null, reais(i.vl_arrecadacao)));
      });
      nd += d ?? 0; nr += r ?? 0; if (!d && !r) vazios++;
    }
    console.log(`tce    ${ano}: ${nd.toLocaleString("pt-BR")} lançamentos de despesa · ${nr.toLocaleString("pt-BR")} de receita${vazios ? ` · ${vazios} meses vazios` : ""}`);
  }
  db.close();
}

for (const f of alvo) await { siconfi, ibge, bacen, tce }[f]();
