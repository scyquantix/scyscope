"use client";

import { useMemo, useRef, type RefObject } from "react";
import { tokenizar } from "@/lib/sql";

/** Textarea transparente sobre um <pre> colorido: edição nativa (desfazer, seleção, IME) com destaque de sintaxe. */
export function Editor({ valor, aoMudar, aoExecutar, aoSalvar, campo }: {
  valor: string;
  aoMudar: (v: string) => void;
  aoExecutar: (trecho?: string) => void;
  aoSalvar: () => void;
  campo: RefObject<HTMLTextAreaElement | null>;
}) {
  const pre = useRef<HTMLPreElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const tokens = useMemo(() => tokenizar(valor), [valor]);
  const linhas = valor.split("\n").length;

  const sincronizar = () => {
    const t = campo.current;
    if (!t) return;
    if (pre.current) { pre.current.scrollTop = t.scrollTop; pre.current.scrollLeft = t.scrollLeft; }
    if (gutter.current) gutter.current.scrollTop = t.scrollTop;
  };

  const teclas = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.ctrlKey || e.metaKey;
    const t = e.currentTarget;
    if (mod && e.key === "Enter") {
      e.preventDefault();
      // Com texto selecionado, roda só o trecho: útil para testar parte de uma CTE
      const trecho = t.selectionStart !== t.selectionEnd ? valor.slice(t.selectionStart, t.selectionEnd) : undefined;
      aoExecutar(trecho);
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      aoSalvar();
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = t;
      aoMudar(valor.slice(0, a) + "  " + valor.slice(b));
      requestAnimationFrame(() => t.setSelectionRange(a + 2, a + 2));
    }
  };

  return (
    <div className="editor">
      <div className="editor-gutter" ref={gutter} aria-hidden="true">
        {Array.from({ length: linhas }, (_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <pre ref={pre} aria-hidden="true">
        <code>
          {tokens.map((t, i) => (t.tipo === "espaco" || t.tipo === "ident" ? t.valor : <span key={i} className={`sx-${t.tipo}`}>{t.valor}</span>))}
          {"\n"}
        </code>
      </pre>
      <textarea
        ref={campo}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        onScroll={sincronizar}
        onKeyDown={teclas}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        aria-label="Consulta SQL"
      />
    </div>
  );
}
