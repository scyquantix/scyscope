// Formatação pt-BR para a grade de resultados e as estatísticas. Sem dependência de servidor.

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Inteiros abaixo de 10 mil saem sem separador (2026 é um ano, não "2.026"); o resto segue o padrão pt-BR. */
export function numero(v: number): string {
  if (Number.isInteger(v)) return Math.abs(v) < 10_000 ? String(v) : inteiro.format(v);
  return decimal.format(v);
}

export const contagem = (v: number) => inteiro.format(v);
export const curto = (v: number) => compacto.format(v);

export function bytes(n: number) {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${u[i]}`;
}

export const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export function tempoRelativo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  return `há ${Math.floor(s / 86400)} d`;
}

export const ms = (v: number) => (v < 1000 ? `${Math.max(1, Math.round(v))} ms` : `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`);

/** Célula como texto: o mesmo para a tela, a cópia e o CSV (cru, sem separador de milhar). */
export const cru = (v: unknown) => (v == null ? "" : String(v));
