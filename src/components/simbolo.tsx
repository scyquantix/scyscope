import { useId } from "react";

/**
 * Símbolo ScyQuantix redesenhado em vetor a partir do manual (S e Q num hexágono, cubo ao centro).
 * Aproximação: troque pelo SVG oficial quando houver. As cores vêm dos tokens --marca-* e --cubo-*,
 * então o degradê se ajusta aos temas claro e escuro.
 */
export function Simbolo({ titulo }: { titulo?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" role={titulo ? "img" : undefined} aria-hidden={titulo ? undefined : true} aria-label={titulo}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" style={{ stopColor: "var(--marca-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--marca-b)" }} />
        </linearGradient>
      </defs>
      {/* S: arco superior esquerdo */}
      <path d="M45 10.5 32 3 7 17.5v21l8 4.6V22.1L32 12.3l13 7.5Z" fill={`url(#${id}-g)`} />
      {/* Q: arco inferior direito */}
      <path d="M19 53.5 32 61l25-14.5v-21l-8-4.6v20.4L32 51.7l-13-7.5Z" fill={`url(#${id}-g)`} />
      {/* cauda do Q */}
      <path d="m33.5 40.3 7-4 17 18.4-7.4 4.2Z" style={{ fill: "var(--marca-b)" }} />
      {/* cubo: evidência, estrutura e valor real */}
      <path d="m32 21.5 7.5 4.3L32 30.1l-7.5-4.3Z" style={{ fill: "var(--cubo-topo)" }} />
      <path d="M24.5 25.8 32 30.1v8.6l-7.5-4.3Z" style={{ fill: "var(--cubo-esq)" }} />
      <path d="M39.5 25.8 32 30.1v8.6l7.5-4.3Z" style={{ fill: "var(--cubo-dir)" }} />
    </svg>
  );
}
