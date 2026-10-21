import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { statSync } from "node:fs";
import { ARQUIVOS, fontesDisponiveis } from "./config";
import { DESCRICOES, FONTES, type IdFonte } from "./fontes";
import { identificador } from "./sql";
import { conectar } from "../../workers/anexar.mjs";

let conexao: { db: DatabaseSync; chave: string } | null = null;

/** Conexão somente leitura com todas as fontes anexadas; refeita se uma fonte nova aparecer. */
export function dados(): DatabaseSync {
  const fontes = fontesDisponiveis();
  if (!fontes.length) throw new Error("Nenhuma fonte sincronizada. Rode npm run sync.");
  const chave = fontes.map((f) => f.id).join(",");
  if (conexao?.chave !== chave) {
    conexao?.db.close();
    conexao = { db: conectar(fontes), chave };
  }
  return conexao.db;
}

export type ColunaEsquema = { nome: string; tipo: string; pk: boolean; obrigatoria: boolean };
export type Tabela = {
  esquema: IdFonte; nome: string; completo: string; tipo: "table" | "view"; linhas: number; descricao: string | null;
  colunas: ColunaEsquema[]; indices: { nome: string; colunas: string[] }[];
};
export type EsquemaFonte = { id: IdFonte; tabelas: Tabela[]; arquivo: string; bytes: number; modificado: string };

export function esquemas(): EsquemaFonte[] {
  const db = dados();
  return fontesDisponiveis().map(({ id, arquivo }) => {
    const s = id; // nome validado em conectar(): só letras e _
    const objetos = db
      .prepare(`SELECT name, type FROM ${s}.sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY type, name`)
      .all() as { name: string; type: "table" | "view" }[];
    const tabelas = objetos.map((o) => {
      const colunas = (db.prepare(`SELECT name, type, pk, "notnull" FROM pragma_table_info(?, ?)`).all(o.name, s) as { name: string; type: string; pk: number; notnull: number }[])
        .map((c) => ({ nome: c.name, tipo: c.type || "—", pk: c.pk > 0, obrigatoria: c.notnull === 1 }));
      const indices = (db.prepare("SELECT name FROM pragma_index_list(?, ?)").all(o.name, s) as { name: string }[])
        .filter((i) => !i.name.startsWith("sqlite_autoindex"))
        .map((i) => ({ nome: i.name, colunas: (db.prepare("SELECT name FROM pragma_index_info(?, ?) ORDER BY seqno").all(i.name, s) as { name: string }[]).map((c) => c.name) }));
      const linhas = (db.prepare(`SELECT COUNT(*) n FROM ${s}.${identificador(o.name)}`).get() as { n: number }).n;
      const completo = `${s}.${o.name}`;
      return { esquema: id, nome: o.name, completo, tipo: o.type, linhas, descricao: DESCRICOES[completo] ?? null, colunas, indices };
    });
    // A tabela principal (mais linhas) primeiro; o registro de coletas sempre por último
    tabelas.sort((a, b) => Number(a.nome === "coletas") - Number(b.nome === "coletas") || b.linhas - a.linhas);
    const st = statSync(arquivo);
    return { id, tabelas, arquivo, bytes: st.size, modificado: st.mtime.toISOString() };
  });
}

export const todasTabelas = () => esquemas().flatMap((e) => e.tabelas);

/** Aceita "siconfi.linhas"; sem esquema, procura o nome nas fontes na ordem do catálogo. */
export function tabela(nome: string): Tabela | null {
  const ts = todasTabelas();
  return ts.find((t) => t.completo === nome) ?? ts.find((t) => t.nome === nome) ?? null;
}

/** FROM seguro para uma tabela de uma fonte. */
export const origem = (t: Pick<Tabela, "esquema" | "nome">) => `${t.esquema}.${identificador(t.nome)}`;

export const fontesAusentes = () => FONTES.filter((f) => !fontesDisponiveis().some((d) => d.id === f.id)).map((f) => ({ ...f, arquivo: ARQUIVOS[f.id] }));
