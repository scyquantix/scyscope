import "server-only";
import { comoUsuario, db, simples } from "./banco";

// Consultas salvas e histórico de cada usuário. A leitura passa pelas views filtradas por usuario_atual() e a
// escrita pelos gatilhos de RLS (banco.ts): mesmo um id errado aqui não alcança as linhas de outra pessoa.

export type Salva = { id: number; nome: string; sql: string; criada: string; atualizada: string };
export type ItemHistorico = { id: number; sql: string; quando: string; ms: number | null; linhas: number | null; erro: string | null };

export const listarSalvas = (usuarioId: string) =>
  comoUsuario(usuarioId, () => simples<Salva>(db().prepare("SELECT id, nome, sql, criada, atualizada FROM minhas_salvas ORDER BY atualizada DESC").all()));

export function salvar(usuarioId: string, nome: string, sql: string, id?: number): number {
  const agora = new Date().toISOString();
  return comoUsuario(usuarioId, () => {
    if (id) {
      db().prepare("UPDATE salvas SET nome = ?, sql = ?, atualizada = ? WHERE id = ? AND usuario_id = usuario_atual()").run(nome, sql, agora, id);
      return id;
    }
    return Number(db().prepare("INSERT INTO salvas (usuario_id, nome, sql, criada, atualizada) VALUES (usuario_atual(), ?, ?, ?, ?)").run(nome, sql, agora, agora).lastInsertRowid);
  });
}

export const excluirSalva = (usuarioId: string, id: number) =>
  comoUsuario(usuarioId, () => db().prepare("DELETE FROM salvas WHERE id = ? AND usuario_id = usuario_atual()").run(id));

export function registrar(usuarioId: string, sql: string, ms: number, linhas: number | null, erro: string | null) {
  comoUsuario(usuarioId, () => {
    const d = db();
    // Repetir a mesma consulta em seguida só atualiza a entrada mais recente
    const ultima = d.prepare("SELECT id, sql FROM meu_historico ORDER BY id DESC LIMIT 1").get() as { id: number; sql: string } | undefined;
    if (ultima?.sql === sql) d.prepare("UPDATE historico SET quando = ?, ms = ?, linhas = ?, erro = ? WHERE id = ?").run(new Date().toISOString(), ms, linhas, erro, ultima.id);
    else d.prepare("INSERT INTO historico (usuario_id, sql, quando, ms, linhas, erro) VALUES (usuario_atual(), ?, ?, ?, ?, ?)").run(sql, new Date().toISOString(), ms, linhas, erro);
    d.prepare("DELETE FROM historico WHERE usuario_id = usuario_atual() AND id NOT IN (SELECT id FROM meu_historico ORDER BY id DESC LIMIT 200)").run();
  });
}

export const listarHistorico = (usuarioId: string, n = 30) =>
  comoUsuario(usuarioId, () => simples<ItemHistorico>(db().prepare("SELECT id, sql, quando, ms, linhas, erro FROM meu_historico ORDER BY id DESC LIMIT ?").all(n)));
