"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { abrirSessao, autenticar, definirSenhaInicial, encerrarSessao, igualSenhaAtual, SENHA_IGUAL, validarSenhaNova } from "@/lib/acesso";
import { motivoRecusa } from "@/lib/regras-senha";
import { apagarCookie, gravarCookie, tokenAtual, usuarioAtual } from "@/lib/sessao";

export type EstadoForm = { erro: string | null; login?: string };

const texto = (f: FormData, k: string) => String(f.get(k) ?? "");

/** Só caminhos internos: um ?de=//outro-site levaria o usuário para fora depois do login. */
const destinoSeguro = (de: string) => (de.startsWith("/") && !de.startsWith("//") && !de.startsWith("/\\") ? de : "/");

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const login = texto(form, "login").trim().slice(0, 64);
  const senha = texto(form, "senha").slice(0, 200);
  if (!login || !senha) return { erro: "Informe login e senha.", login };

  const r = await autenticar(login, senha);
  if (!r.ok) return { erro: r.erro, login };

  const { token, expira } = abrirSessao(r.usuario.id, (await headers()).get("user-agent"));
  await gravarCookie(token, expira);
  redirect(r.usuario.trocarSenha ? "/nova-senha" : destinoSeguro(texto(form, "de")));
}

export async function registrarSenha(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const [u, token] = [await usuarioAtual(), await tokenAtual()];
  if (!u || !token) redirect("/entrar");
  if (!u.trocarSenha) redirect("/");

  const nova = texto(form, "nova");
  const erro = validarSenhaNova(u, nova, texto(form, "confirmacao")) ?? (await definirSenhaInicial(u, token, nova));
  if (erro) return { erro };
  redirect("/");
}

/**
 * Para o medidor de força: motivo da recusa se a senha nova for igual à atual, ou null. Só responde a quem está na
 * troca obrigatória e para senhas que já passam nas outras regras, o que limita as chamadas ao scrypt.
 */
export async function conferirSenhaNova(nova: string): Promise<string | null> {
  const u = await usuarioAtual();
  if (!u?.trocarSenha || motivoRecusa(nova, u.login)) return null;
  return (await igualSenhaAtual(u.id, nova)) ? SENHA_IGUAL : null;
}

export async function sair() {
  const token = await tokenAtual();
  if (token) encerrarSessao(token);
  await apagarCookie();
  redirect("/entrar");
}
