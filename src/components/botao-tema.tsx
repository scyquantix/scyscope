"use client";

import { useEffect, useState } from "react";

export function BotaoTema() {
  const [tema, setTema] = useState<"dark" | "light">("light");
  useEffect(() => setTema(document.documentElement.dataset.theme === "dark" ? "dark" : "light"), []);
  const alternar = () => {
    const novo = tema === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem("tema-scyscope", novo); } catch {}
    setTema(novo);
  };
  const rotulo = tema === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro";
  return (
    <button type="button" className="icone-botao" onClick={alternar} aria-label={rotulo} title={rotulo}>
      {tema === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      )}
    </button>
  );
}
