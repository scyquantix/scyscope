import { useId } from "react";

/**
 * Marca do ScyScope, como o card do produto no site da ScyQuantix: uma lupa, aqui com o cubo do símbolo
 * ScyQuantix dentro da lente. Cores pelos tokens --marca-* e --cubo-*, que mudam com o tema.
 */
export function MarcaScope() {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--marca-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--marca-b)" }} />
        </linearGradient>
      </defs>
      <circle cx="13" cy="13" r="9.5" fill="none" stroke={`url(#${id}-g)`} strokeWidth="2.6" />
      <path d="m20.2 20.2 7.3 7.3" strokeWidth="3.4" strokeLinecap="round" style={{ stroke: "var(--marca-b)" }} />
      <path d="m13 8.8 4 2.3-4 2.3-4-2.3Z" style={{ fill: "var(--cubo-topo)" }} />
      <path d="m9 11.1 4 2.3v4.6l-4-2.3Z" style={{ fill: "var(--cubo-esq)" }} />
      <path d="m17 11.1-4 2.3v4.6l4-2.3Z" style={{ fill: "var(--cubo-dir)" }} />
    </svg>
  );
}

/** Ícones de traço fino no estilo do site: contorno na cor do texto, um detalhe em ciano (.ico-acento). */
const TRACO = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconeSql() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...TRACO}>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
      <path className="ico-acento" d="m13.5 5-3 14" />
    </svg>
  );
}

export function IconeCatalogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...TRACO}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
      <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13" />
      <path className="ico-acento" d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
    </svg>
  );
}

export function IconeSair() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...TRACO}>
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" />
      <path className="ico-acento" d="M4 12h11M10.5 7.5 15 12l-4.5 4.5" />
    </svg>
  );
}

export function IconeRelatorio() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...TRACO}>
      <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8Z" />
      <path d="M14 3v5h5" />
      <path className="ico-acento" d="M8.5 12.5h7M8.5 16h7M12 12.5V16" />
    </svg>
  );
}
