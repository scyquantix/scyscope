import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/sessao";
import { FormEntrar } from "@/components/form-acesso";

export const metadata: Metadata = { title: "Entrar" };

type Props = { searchParams: Promise<{ de?: string }> };

export default async function Entrar({ searchParams }: Props) {
  const u = await usuarioAtual();
  if (u) redirect(u.trocarSenha ? "/nova-senha" : "/");
  const { de } = await searchParams;
  return (
    <>
      <div>
        <h2>Entrar</h2>
        <p className="mudo">Acesse com o login e a senha da sua conta ScyQuantix.</p>
      </div>
      <FormEntrar de={de ?? "/"} />
    </>
  );
}
