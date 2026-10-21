// Executa uma consulta numa thread separada, para que o processo principal possa
// encerrá-la se passar do tempo limite. Cada fonte entra como esquema somente leitura
// (siconfi, tce, ibge, bacen) e o autorizador do SQLite nega tudo que não seja leitura.

import { parentPort, workerData } from "node:worker_threads";
import { autorizar } from "./autorizador.mjs";
import { conectar } from "./anexar.mjs";

/** Valores que não atravessam para o cliente como estão viram texto legível. */
function serializavel(v) {
  if (v instanceof Uint8Array) return `<blob ${v.byteLength} bytes>`;
  if (typeof v === "bigint") return Number(v);
  return v;
}

function executar({ fontes, sql, limite, plano }) {
  const inicio = performance.now();
  let db;
  try {
    db = conectar(fontes);
    db.setAuthorizer(autorizar);
    const stmt = db.prepare(sql);
    stmt.setReturnArrays(true);
    const colunas = stmt.columns().map((col) => ({ nome: col.name, tipo: col.type, tabela: col.table, coluna: col.column }));
    const linhas = [];
    let cortado = false;
    for (const linha of stmt.iterate()) {
      if (linhas.length === limite) { cortado = true; break; }
      linhas.push(linha.map(serializavel));
    }
    const ms = performance.now() - inicio;

    let planoLinhas = null;
    if (plano) {
      const p = db.prepare(`EXPLAIN QUERY PLAN ${sql}`);
      planoLinhas = p.all().map((r) => ({ id: r.id, pai: r.parent, detalhe: r.detail }));
    }
    return { ok: true, colunas, linhas, cortado, ms, plano: planoLinhas };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : String(e), ms: performance.now() - inicio };
  } finally {
    db?.close();
  }
}

if (parentPort && workerData) parentPort.postMessage(executar(workerData));
