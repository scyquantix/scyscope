import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { sair } from "@/app/acesso";
import { FormNovaSenha } from "@/components/form-acesso";

export const metadata: Metadata = { title: "Nova senha" };

export default async function NovaSenha() {
  const u = await usuarioAtual();
  if (!u) redirect("/entrar");
  if (!u.trocarSenha) redirect("/");
  return (
    <>
      <div>
        <p className="sobretitulo">Primeiro acesso</p>
        <h2>Registre sua senha</h2>
        <p className="mudo">Olá, {u.nome.split(" ")[0]}. Antes de continuar, troque a senha inicial por uma só sua.</p>
      </div>
      <FormNovaSenha login={u.login} />
      <form action={sair}>
        <button type="submit" className="acesso-link">Sair e entrar com outra conta</button>
      </form>
    </>
  );
}
