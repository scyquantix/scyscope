import { useId, type SVGProps } from "react";
import { SYMBOL_VIEWBOX, symbolPaths, WORDMARK_VIEWBOX, wordmarkLetters, wordmarkQ } from "./logo-paths";

/*
 * Logo oficial da ScyQuantix, portado de scyhome/packages/ui/src/components/logo.tsx sem Tailwind.
 * As cores são as da arte original e não seguem o tema: o logo é o mesmo no claro e no escuro.
 * Quando o ScyScope entrar no monorepo, trocar por @scyquantix/ui.
 */

type Peca = keyof typeof symbolPaths;

/** Ordem de desenho e preenchimento de cada peça do símbolo. */
const PECAS: { chave: Peca; fill: string }[] = [
  { chave: "top", fill: "top" },
  { chave: "mid", fill: "mid" },
  { chave: "low", fill: "low" },
  { chave: "right", fill: "right" },
  { chave: "stem", fill: "stem" },
  { chave: "tail", fill: "tail" },
  { chave: "cubeTop", fill: "#13C3DF" },
  { chave: "cubeLeft", fill: "#0B6A8A" },
  { chave: "cubeRight", fill: "#049BBA" },
];

type PropsSvg = Omit<SVGProps<SVGSVGElement>, "viewBox"> & { titulo?: string };

/** Símbolo: S e Q em estrutura hexagonal isométrica com o cubo central. */
export function LogoSimbolo({ titulo = "ScyQuantix", ...props }: PropsSvg) {
  const id = useId();
  const tinta = (nome: string) => (nome.startsWith("#") ? nome : `url(#${id}-${nome})`);
  return (
    <svg viewBox={SYMBOL_VIEWBOX} role="img" aria-label={titulo} {...props}>
      <defs>
        <linearGradient id={`${id}-top`} x1="344" y1="2" x2="2" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#05365A" />
          <stop offset="1" stopColor="#022640" />
        </linearGradient>
        <linearGradient id={`${id}-mid`} x1="2" y1="250" x2="335" y2="470" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#105479" />
          <stop offset="1" stopColor="#063959" />
        </linearGradient>
        <linearGradient id={`${id}-low`} x1="2" y1="480" x2="335" y2="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#105174" />
          <stop offset="1" stopColor="#042E4B" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="0" y1="20" x2="0" y2="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#05C2DC" />
          <stop offset="0.5" stopColor="#0985A6" />
          <stop offset="1" stopColor="#0A466A" />
        </linearGradient>
        <linearGradient id={`${id}-stem`} x1="0" y1="330" x2="0" y2="544" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#13597F" />
          <stop offset="1" stopColor="#094563" />
        </linearGradient>
        <linearGradient id={`${id}-tail`} x1="380" y1="540" x2="717" y2="660" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#04B4D2" />
          <stop offset="1" stopColor="#0A7599" />
        </linearGradient>
      </defs>
      {/* O contorno da mesma cor arredonda levemente os cantos, como na arte original. */}
      <g strokeWidth={8} strokeLinejoin="round">
        {PECAS.map(({ chave, fill }) => (
          <path key={chave} d={symbolPaths[chave]} fill={tinta(fill)} stroke={tinta(fill)} />
        ))}
      </g>
    </svg>
  );
}

/** Nome "ScyQuantix" em contornos vetoriais (Eurostile), com o Q em degradê ciano. */
export function LogoNome({ titulo = "ScyQuantix", ...props }: PropsSvg) {
  const id = useId();
  return (
    <svg viewBox={WORDMARK_VIEWBOX} role="img" aria-label={titulo} {...props}>
      <defs>
        <linearGradient id={`${id}-q`} x1="0" y1="4" x2="0" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#00C2D4" />
          <stop offset="0.6" stopColor="#06A9C6" />
          <stop offset="1" stopColor="#0A7FA0" />
        </linearGradient>
      </defs>
      <path fill="#0B2D4A" fillRule="evenodd" d={wordmarkLetters} />
      <path fill={`url(#${id}-q)`} fillRule="evenodd" d={wordmarkQ} />
    </svg>
  );
}

/** Variação horizontal com a assinatura, como no cabeçalho do site. O tamanho acompanha o font-size de .logo. */
export function Logo() {
  return (
    <span className="logo">
      <LogoSimbolo aria-hidden className="logo-simbolo" />
      <span className="logo-txt">
        <LogoNome aria-hidden className="logo-nome" />
        <span className="sr">ScyQuantix</span>
        <span className="logo-assinatura">Tecnologia orientada por evidências</span>
      </span>
    </span>
  );
}
