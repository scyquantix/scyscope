import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Nunito_Sans, Sora } from "next/font/google";
import "./globals.css";

// Tipografia ScyQuantix: Sora para a marca e os títulos (geométrica e larga como o logotipo), Nunito Sans no texto
const display = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display", display: "swap" });
const sans = Nunito_Sans({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-sans", display: "swap" });
// Inter só na assinatura do logo oficial, que no site é composta nela
const inter = Inter({ subsets: ["latin"], weight: ["500"], variable: "--font-inter", display: "swap" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ScyScope · ScyQuantix", template: "%s · ScyScope" },
  description: "ScyScope, da ScyQuantix: explore dados públicos do Brasil (SICONFI, TCE-SP, IBGE, BACEN) com SQL. MVP com Ferraz de Vasconcelos (SP).",
};

const scriptTema = `try{var t=localStorage.getItem("tema-scyscope");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// O trilho de navegação fica em (app)/layout.tsx; as telas de login, em (acesso)/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-theme="light" className={`${display.variable} ${sans.variable} ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptTema }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
