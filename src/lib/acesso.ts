import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { comoServico, comoUsuario, db } from "./banco";
import { DURACAO_SESSAO_MS } from "./cookie";
import { motivoRecusa } from "./regras-senha";
import { conferir, gerarHash, HASH_FICTICIO } from "./senha";

export type Usuario = { id: string; login: string; nome: string; trocarSenha: boolean };
type Linha = { id: string; login: string; nome: string; senha_hash: string; trocar_senha: number; ativo: number };

/** Falhas seguidas que bloqueiam o login, e por quanto tempo. */
const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;

const agora = () => new Date().toISOString();
const resumo = (token: string) => createHash("sha256").update(token).digest("hex");
const paraUsuario = (l: Linha): Usuario => ({ id: l.id, login: l.login, nome: l.nome, trocarSenha: l.trocar_senha === 1 });

function registrarAcesso(login: string, evento: "entrada" | "saida" | "falha" | "bloqueio" | "troca_senha", usuarioId: string | null = null) {
  db().prepare("INSERT INTO acessos (usuario_id, login, evento, quando) VALUES (?, ?, ?, ?)").run(usuarioId, login.toLowerCase(), evento, agora());
}

/** Falhas desde a última entrada bem-sucedida, dentro da janela. */
function falhasRecentes(login: string): { n: number; primeira: string | null } {
  const desde = new Date(Date.now() - JANELA_MS).toISOString();
  return db().prepare(`
    SELECT count(*) AS n, min(quando) AS primeira FROM acessos
    WHERE login = ? COLLATE NOCASE AND evento = 'falha' AND quando > ?
      AND quando > coalesce((SELECT max(quando) FROM acessos WHERE login = ? COLLATE NOCASE AND evento = 'entrada'), '')
  `).get(login, desde, login) as { n: number; primeira: string | null };
}

export type Autenticacao = { ok: true; usuario: Usuario } | { ok: false; erro: string };

export async function autenticar(login: string, senha: string): Promise<Autenticacao> {
  const linha = comoServico(() => db().prepare("SELECT * FROM usuarios WHERE login = ?").get(login) as Linha | undefined);

  const falhas = comoServico(() => falhasRecentes(login));
  if (falhas.n >= MAX_FALHAS) {
    comoServico(() => registrarAcesso(login, "bloqueio", linha?.id));
    const min = Math.max(1, Math.ceil((Date.parse(falhas.primeira!) + JANELA_MS - Date.now()) / 60000));
    return { ok: false, erro: `Muitas tentativas sem sucesso. Tente de novo em ${min} min.` };
  }

  // Login inexistente também passa pelo scrypt, para o tempo de resposta não revelar quem tem conta
  const certa = await conferir(senha, linha?.senha_hash ?? HASH_FICTICIO);
  if (!linha || !certa || linha.ativo !== 1) {
    comoServico(() => registrarAcesso(login, "falha", linha?.id));
    return { ok: false, erro: "Login ou senha incorretos." };
  }

  comoUsuario(linha.id, () => {
    db().prepare("UPDATE usuarios SET ultimo_acesso = ? WHERE id = ?").run(agora(), linha.id);
    registrarAcesso(linha.login, "entrada", linha.id);
  });
  return { ok: true, usuario: paraUsuario(linha) };
}

/** Abre a sessão e devolve o token do cookie. O banco guarda só o SHA-256 dele. */
export function abrirSessao(usuarioId: string, agente: string | null): { token: string; expira: Date } {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + DURACAO_SESSAO_MS);
  comoUsuario(usuarioId, () =>
    db().prepare("INSERT INTO sessoes (id, usuario_id, criada, expira, agente) VALUES (?, usuario_atual(), ?, ?, ?)")
      .run(resumo(token), agora(), expira.toISOString(), agente?.slice(0, 300) ?? null),
  );
  return { token, expira };
}

/** Usuário de uma sessão aberta e dentro da validade, ou null. */
export function usuarioDaSessao(token: string): Usuario | null {
  const linha = comoServico(() => db().prepare(`
    SELECT u.* FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.id = ? AND s.encerrada IS NULL AND s.expira > ? AND u.ativo = 1
  `).get(resumo(token), agora()) as Linha | undefined);
  return linha ? paraUsuario(linha) : null;
}

/** Logoff: marca a sessão como encerrada e registra a saída. */
export function encerrarSessao(token: string) {
  const id = resumo(token);
  const s = comoServico(() => db().prepare("SELECT s.usuario_id, u.login FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.id = ? AND s.encerrada IS NULL").get(id) as { usuario_id: string; login: string } | undefined);
  if (!s) return;
  comoUsuario(s.usuario_id, () => {
    db().prepare("UPDATE sessoes SET encerrada = ? WHERE id = ?").run(agora(), id);
    registrarAcesso(s.login, "saida", s.usuario_id);
  });
}

/** Regras da senha nova. Devolve a mensagem de erro, ou null se estiver boa. */
export function validarSenhaNova(usuario: Usuario, nova: string, confirmacao: string): string | null {
  const recusa = motivoRecusa(nova, usuario.login);
  if (recusa) return recusa;
  if (nova !== confirmacao) return "A confirmação não confere com a senha nova.";
  return null;
}

export const SENHA_IGUAL = "A senha nova precisa ser diferente da inicial.";

/** Se a senha é a que o usuário tem hoje. O medidor de força usa para marcar a senha inicial como incompatível. */
export async function igualSenhaAtual(usuarioId: string, senha: string): Promise<boolean> {
  const linha = comoServico(() => db().prepare("SELECT senha_hash FROM usuarios WHERE id = ?").get(usuarioId) as { senha_hash: string } | undefined);
  return !!linha && (await conferir(senha, linha.senha_hash));
}

/**
 * Registra a senha nova no primeiro acesso: a sessão acabou de conferir a senha inicial, então ela não é pedida de novo.
 * Encerra as outras sessões do usuário e libera o acesso.
 */
export async function definirSenhaInicial(usuario: Usuario, tokenAtual: string, nova: string): Promise<string | null> {
  const linha = comoServico(() => db().prepare("SELECT trocar_senha FROM usuarios WHERE id = ?").get(usuario.id) as { trocar_senha: number } | undefined);
  if (!linha || linha.trocar_senha !== 1) return "A senha já foi registrada.";
  if (await igualSenhaAtual(usuario.id, nova)) return SENHA_IGUAL;
  const hash = await gerarHash(nova);
  comoUsuario(usuario.id, () => {
    const d = db();
    d.prepare("UPDATE usuarios SET senha_hash = ?, trocar_senha = 0, senha_alterada = ? WHERE id = ?").run(hash, agora(), usuario.id);
    d.prepare("UPDATE sessoes SET encerrada = ? WHERE usuario_id = ? AND id <> ? AND encerrada IS NULL").run(agora(), usuario.id, resumo(tokenAtual));
    registrarAcesso(usuario.login, "troca_senha", usuario.id);
  });
  return null;
}
