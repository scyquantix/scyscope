import Link from "next/link";
import { fontesDisponiveis } from "@/lib/config";
import { exigirUsuario } from "@/lib/sessao";
import { sair } from "@/app/acesso";
import { Navegacao } from "@/components/navegacao";
import { BotaoTema } from "@/components/botao-tema";
import { IconeSair, MarcaScope } from "@/components/icones";

const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).map((p) => p[0]).filter((_, i, a) => i === 0 || i === a.length - 1).join("").toUpperCase();

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const fontes = fontesDisponiveis();
  return (
    <div className="casca">
      <header className="trilho">
        <Link href="/" className="marca" aria-label="ScyScope, da ScyQuantix">
          <MarcaScope />
          <span className="marca-txt">
            <span className="marca-nome">Scy<em>Scope</em></span>
            <span className="marca-endosso">ScyQuantix</span>
          </span>
        </Link>
        <Navegacao />
        <div className="trilho-pe">
          <span className="chip-banco" title="Cada fonte é um esquema SQL somente leitura">
            {fontes.map((f) => f.id).join(" · ")}
            <span>somente leitura</span>
          </span>
          <BotaoTema />
        </div>
        <form action={sair} className="usuario">
          <span className="usuario-avatar" aria-hidden="true">{iniciais(usuario.nome)}</span>
          <span className="usuario-txt">
            <span className="usuario-nome">{usuario.nome}</span>
            <span className="usuario-login mono">{usuario.login}</span>
          </span>
          <button type="submit" className="icone-botao" aria-label="Sair" title={`Sair (${usuario.login})`}>
            <IconeSair />
          </button>
        </form>
      </header>
      <div className="conteudo">{children}</div>
    </div>
  );
}
