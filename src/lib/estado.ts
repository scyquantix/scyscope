import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ARQUIVO_ESTADO } from "./config";

let conexao: DatabaseSync | null = null;

function db(): DatabaseSync {
  if (conexao) return conexao;
  mkdirSync(dirname(ARQUIVO_ESTADO), { recursive: true });
  conexao = new DatabaseSync(ARQUIVO_ESTADO);
  conexao.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS salvas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      sql TEXT NOT NULL,
      criada TEXT NOT NULL,
      atualizada TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sql TEXT NOT NULL,
      quando TEXT NOT NULL,
      ms REAL,
      linhas INTEGER,
      erro TEXT
    );
  `);
  return conexao;
}

export type Salva = { id: number; nome: string; sql: string; criada: string; atualizada: string };
export type ItemHistorico = { id: number; sql: string; quando: string; ms: number | null; linhas: number | null; erro: string | null };

// O node:sqlite devolve objetos sem protótipo, que o React não envia ao cliente: copiar para objetos comuns
const simples = <T,>(linhas: unknown[]) => linhas.map((l) => ({ ...(l as object) })) as T[];

export const listarSalvas = () => simples<Salva>(db().prepare("SELECT * FROM salvas ORDER BY atualizada DESC").all());

export function salvar(nome: string, sql: string, id?: number): number {
  const agora = new Date().toISOString();
  if (id) {
    db().prepare("UPDATE salvas SET nome = ?, sql = ?, atualizada = ? WHERE id = ?").run(nome, sql, agora, id);
    return id;
  }
  return Number(db().prepare("INSERT INTO salvas (nome, sql, criada, atualizada) VALUES (?, ?, ?, ?)").run(nome, sql, agora, agora).lastInsertRowid);
}

export const excluirSalva = (id: number) => db().prepare("DELETE FROM salvas WHERE id = ?").run(id);

export function registrar(sql: string, ms: number, linhas: number | null, erro: string | null) {
  const d = db();
  // Repetir a mesma consulta em seguida só atualiza a entrada mais recente
  const ultima = d.prepare("SELECT id, sql FROM historico ORDER BY id DESC LIMIT 1").get() as { id: number; sql: string } | undefined;
  if (ultima?.sql === sql) d.prepare("UPDATE historico SET quando = ?, ms = ?, linhas = ?, erro = ? WHERE id = ?").run(new Date().toISOString(), ms, linhas, erro, ultima.id);
  else d.prepare("INSERT INTO historico (sql, quando, ms, linhas, erro) VALUES (?, ?, ?, ?, ?)").run(sql, new Date().toISOString(), ms, linhas, erro);
  d.prepare("DELETE FROM historico WHERE id NOT IN (SELECT id FROM historico ORDER BY id DESC LIMIT 200)").run();
}

export const listarHistorico = (n = 30) => simples<ItemHistorico>(db().prepare("SELECT * FROM historico ORDER BY id DESC LIMIT ?").all(n));
