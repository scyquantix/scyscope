import "server-only";
import { Worker } from "node:worker_threads";
import { join } from "node:path";
import { fontesDisponiveis, LIMITE_LINHAS, TEMPO_LIMITE_MS } from "./config";
import { contarInstrucoes } from "./sql";

export type Coluna = { nome: string; tipo: string | null; tabela: string | null; coluna: string | null };
export type Valor = string | number | null;
export type Resultado =
  | { ok: true; colunas: Coluna[]; linhas: Valor[][]; cortado: boolean; ms: number; plano: { id: number; pai: number; detalhe: string }[] | null }
  | { ok: false; erro: string; ms: number };

const WORKER = join(/*turbopackIgnore: true*/ process.cwd(), "workers", "consulta.mjs");

/** Mensagens do SQLite traduzidas quando o motivo é a regra de só-leitura do ScyScope. */
function explicar(erro: string): string {
  if (/not authorized|authorization denied/i.test(erro)) return "O ScyScope só permite leitura: SELECT, WITH e os PRAGMAs de esquema (table_info, index_list…).";
  if (/readonly/i.test(erro)) return "O banco está aberto em modo somente leitura.";
  return erro;
}

export async function executar(sql: string, { limite = LIMITE_LINHAS, plano = true } = {}): Promise<Resultado> {
  const texto = sql.trim();
  if (!texto) return { ok: false, erro: "Escreva uma consulta.", ms: 0 };
  if (contarInstrucoes(texto) > 1) return { ok: false, erro: "Uma instrução por vez: separe as consultas e rode cada uma.", ms: 0 };
  const fontes = fontesDisponiveis();
  if (!fontes.length) return { ok: false, erro: "Nenhuma fonte sincronizada. Rode npm run sync.", ms: 0 };

  return new Promise((resolver) => {
    const worker = new Worker(WORKER, { workerData: { fontes, sql: texto.replace(/;\s*$/, ""), limite, plano } });
    const inicio = performance.now();
    const relogio = setTimeout(() => {
      worker.terminate();
      resolver({ ok: false, erro: `A consulta passou de ${TEMPO_LIMITE_MS / 1000} s e foi interrompida. Filtre mais ou agregue antes.`, ms: performance.now() - inicio });
    }, TEMPO_LIMITE_MS);
    worker.once("message", (r: Resultado) => {
      clearTimeout(relogio);
      resolver(r.ok ? r : { ...r, erro: explicar(r.erro) });
    });
    worker.once("error", (e) => {
      clearTimeout(relogio);
      resolver({ ok: false, erro: e.message, ms: performance.now() - inicio });
    });
  });
}
