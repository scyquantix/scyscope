// Tokenizador de SQL compartilhado: alimenta o destaque de sintaxe no editor (cliente)
// e a checagem de "uma instrução só" no servidor.

export type Token = { tipo: "palavra" | "funcao" | "texto" | "numero" | "comentario" | "ident" | "simbolo" | "espaco"; valor: string };

const PALAVRAS = new Set(`select from where and or not in is null like glob between group by order having limit offset as on join left right inner
outer cross full natural using with recursive union all intersect except distinct case when then else end asc desc exists cast collate
over partition window rows range preceding following unbounded current row filter explain query plan pragma values true false nulls first last
escape`.split(/\s+/));

export function tokenizar(sql: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    const resto = sql.slice(i);
    let m: RegExpMatchArray | null;
    if ((m = resto.match(/^\s+/))) tokens.push({ tipo: "espaco", valor: m[0] });
    else if (resto.startsWith("--")) { const fim = sql.indexOf("\n", i); tokens.push({ tipo: "comentario", valor: sql.slice(i, fim === -1 ? n : fim) }); }
    else if (resto.startsWith("/*")) { const fim = sql.indexOf("*/", i + 2); tokens.push({ tipo: "comentario", valor: sql.slice(i, fim === -1 ? n : fim + 2) }); }
    else if (ch === "'") { m = resto.match(/^'(?:[^']|'')*'?/); tokens.push({ tipo: "texto", valor: m![0] }); }
    else if (ch === '"' || ch === "`") { m = resto.match(ch === '"' ? /^"(?:[^"]|"")*"?/ : /^`[^`]*`?/); tokens.push({ tipo: "ident", valor: m![0] }); }
    else if (ch === "[") { const fim = sql.indexOf("]", i); tokens.push({ tipo: "ident", valor: sql.slice(i, fim === -1 ? n : fim + 1) }); }
    else if ((m = resto.match(/^(?:\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/i))) tokens.push({ tipo: "numero", valor: m[0] });
    else if ((m = resto.match(/^[A-Za-z_À-ÿ][\wÀ-ÿ$]*/))) {
      const w = m[0];
      const depois = sql.slice(i + w.length).match(/^\s*\(/);
      tokens.push({ tipo: PALAVRAS.has(w.toLowerCase()) ? "palavra" : depois ? "funcao" : "ident", valor: w });
    } else tokens.push({ tipo: "simbolo", valor: ch });
    i += tokens[tokens.length - 1].valor.length;
  }
  return tokens;
}

/** Mais de uma instrução? O SQLite executaria só a primeira e ignoraria o resto em silêncio. */
export function contarInstrucoes(sql: string): number {
  let instrucoes = 0;
  let temConteudo = false;
  for (const t of tokenizar(sql)) {
    if (t.tipo === "espaco" || t.tipo === "comentario") continue;
    if (t.tipo === "simbolo" && t.valor === ";") { if (temConteudo) instrucoes++; temConteudo = false; continue; }
    temConteudo = true;
  }
  return instrucoes + (temConteudo ? 1 : 0);
}

/** Literal SQL seguro para montar consultas a partir da interface. */
export const literal = (v: string | number | null) =>
  v == null ? "NULL" : typeof v === "number" ? String(v) : `'${v.replaceAll("'", "''")}'`;

export const identificador = (nome: string) => `"${nome.replaceAll('"', '""')}"`;

/** Codifica o SQL para a URL (?q=) de forma compacta e sem caracteres especiais. */
export function codificar(sql: string): string {
  const bytes = new TextEncoder().encode(sql);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodificar(q: string): string | null {
  try {
    const bin = atob(q.replaceAll("-", "+").replaceAll("_", "/"));
    return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
  } catch {
    return null;
  }
}
