// Fica fora de sessao.ts porque o proxy também usa e não deve importar o banco.
export const COOKIE_SESSAO = "scyscope_sessao";

/** Duração absoluta da sessão. */
export const DURACAO_SESSAO_MS = 12 * 60 * 60 * 1000;
