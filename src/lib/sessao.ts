import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { usuarioDaSessao, type Usuario } from "./acesso";
import { COOKIE_SESSAO } from "./cookie";

/** Token do cookie da requisição atual. */
export const tokenAtual = async () => (await cookies()).get(COOKIE_SESSAO)?.value ?? null;

/** Usuário logado, consultado uma vez por requisição. */
export const usuarioAtual = cache(async (): Promise<Usuario | null> => {
  const token = await tokenAtual();
  return token ? usuarioDaSessao(token) : null;
});

/**
 * Exige sessão válida e senha já trocada. Toda página, ação e rota com dados chama isto:
 * o proxy só confere se o cookie existe.
 */
export async function exigirUsuario(): Promise<Usuario> {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  if (u.trocarSenha) redirect("/nova-senha");
  return u;
}

export async function gravarCookie(token: string, expira: Date) {
  // secure: false porque o MVP roda em http://127.0.0.1. No deploy (HTTPS) passa a true: docs/acesso.md
  (await cookies()).set(COOKIE_SESSAO, token, { httpOnly: true, sameSite: "lax", secure: false, path: "/", expires: expira });
}

export async function apagarCookie() {
  (await cookies()).delete(COOKIE_SESSAO);
}
