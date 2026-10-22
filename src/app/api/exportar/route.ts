import type { DatabaseSync } from "node:sqlite";
import { fontesDisponiveis, LIMITE_EXPORTACAO } from "@/lib/config";
import { usuarioAtual } from "@/lib/sessao";
import { contarInstrucoes, decodificar } from "@/lib/sql";
import { autorizar } from "../../../../workers/autorizador.mjs";
import { conectar } from "../../../../workers/anexar.mjs";

const csv = (v: unknown) => {
  if (v == null) return "";
  if (v instanceof Uint8Array) return `<blob ${v.byteLength} bytes>`;
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

/** CSV completo do resultado (até 200 mil linhas), gerado em fluxo para não montar tudo na memória. */
export async function GET(req: Request) {
  const u = await usuarioAtual();
  if (!u || u.trocarSenha) return new Response("Sessão necessária.", { status: 401 });
  const sql = decodificar(new URL(req.url).searchParams.get("q") ?? "")?.trim().replace(/;\s*$/, "");
  if (!sql) return new Response("Consulta ausente.", { status: 400 });
  if (contarInstrucoes(sql) > 1) return new Response("Uma instrução por vez.", { status: 400 });

  let db: DatabaseSync;
  let linhas: Iterator<unknown[]>;
  let cabecalho: string;
  try {
    db = conectar(fontesDisponiveis());
    db.setAuthorizer(autorizar);
    const stmt = db.prepare(sql);
    stmt.setReturnArrays(true);
    cabecalho = stmt.columns().map((c) => csv(c.name)).join(",");
    linhas = stmt.iterate() as Iterator<unknown[]>;
  } catch (e) {
    return new Response(e instanceof Error ? e.message : String(e), { status: 400 });
  }

  const enc = new TextEncoder();
  let n = 0;
  const corpo = new ReadableStream<Uint8Array>({
    start(ctl) { ctl.enqueue(enc.encode("﻿" + cabecalho + "\n")); }, // BOM: acentos certos ao abrir no Excel
    pull(ctl) {
      let bloco = "";
      for (let i = 0; i < 2000; i++) {
        const r = linhas.next();
        if (r.done || n >= LIMITE_EXPORTACAO) { if (bloco) ctl.enqueue(enc.encode(bloco)); ctl.close(); db.close(); return; }
        bloco += r.value.map(csv).join(",") + "\n";
        n++;
      }
      ctl.enqueue(enc.encode(bloco));
    },
    cancel() { db.close(); },
  });

  const nome = `scyscope-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
  return new Response(corpo, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "no-store" },
  });
}
