import type { Metadata } from "next";
import { IBM_Plex_Mono, Nunito_Sans, Sora } from "next/font/google";
import Link from "next/link";
import { fontesDisponiveis } from "@/lib/config";
import { Navegacao } from "@/components/navegacao";
import { BotaoTema } from "@/components/botao-tema";
import { MarcaScope } from "@/components/icones";
import "./globals.css";

// Tipografia ScyQuantix: Sora para a marca e os títulos (geométrica e larga como o logotipo), Nunito Sans no texto
const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const sans = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-sans", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ScyScope · ScyQuantix", template: "%s · ScyScope" },
  description: "ScyScope, da ScyQuantix: explore dados públicos do Brasil (SICONFI, TCE-SP, IBGE, BACEN) com SQL. MVP com Ferraz de Vasconcelos (SP).",
};

const scriptTema = `try{var t=localStorage.getItem("tema-scyscope");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const fontes = fontesDisponiveis();
  return (
    <html lang="pt-BR" data-theme="light" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>
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
          </header>
          <div className="conteudo">{children}</div>
        </div>
      </body>
    </html>
  );
}
