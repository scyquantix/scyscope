"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Resultado as R } from "@/lib/executar";
import type { EsquemaFonte } from "@/lib/esquema";
import { FONTES, type Fonte } from "@/lib/fontes";
import type { ItemHistorico, Salva } from "@/lib/estado";
import type { Exemplo } from "@/lib/exemplos";
import { codificar, identificador } from "@/lib/sql";
import { contagem, curto, tempoRelativo } from "@/lib/formato";
import { excluirConsulta, executarConsulta, salvarConsulta } from "@/app/actions";
import { Editor } from "./editor";
import { Resultado } from "./resultado";

type Props = {
  sqlInicial: string;
  resultadoInicial: R | null;
  esquemas: EsquemaFonte[];
  ausentes: Fonte[];
  exemplos: Exemplo[];
  salvas: Salva[];
  historico: ItemHistorico[];
};

export function Bancada({ sqlInicial, resultadoInicial, esquemas, ausentes, exemplos, salvas: salvasIniciais, historico: historicoInicial }: Props) {
  const [sql, setSql] = useState(sqlInicial);
  const [executado, setExecutado] = useState(sqlInicial);
  const [resultado, setResultado] = useState<R | null>(resultadoInicial);
  const [salvas, setSalvas] = useState(salvasIniciais);
  const [historico, setHistorico] = useState(historicoInicial);
  const [atual, setAtual] = useState<Salva | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");
  const [pendente, iniciar] = useTransition();
  const campo = useRef<HTMLTextAreaElement>(null);

  const executar = (trecho?: string) => {
    const alvo = (trecho ?? sql).trim();
    if (!alvo) return;
    iniciar(async () => {
      const r = await executarConsulta(alvo);
      setResultado(r.resultado);
      setHistorico(r.historico);
      setExecutado(alvo);
      // A URL guarda a consulta para compartilhar; trocar sem navegar evita rodar de novo no servidor
      window.history.replaceState(null, "", `/?q=${codificar(trecho ? sql : alvo)}`);
    });
  };

  const abrir = (texto: string, salva: Salva | null = null) => {
    setSql(texto);
    setAtual(salva);
    setSalvando(false);
    campo.current?.focus();
  };

  const inserir = (texto: string) => {
    const t = campo.current;
    if (!t) { setSql((s) => s + texto); return; }
    const a = t.selectionStart, b = t.selectionEnd;
    const novo = sql.slice(0, a) + texto + sql.slice(b);
    setSql(novo);
    requestAnimationFrame(() => { t.focus(); t.setSelectionRange(a + texto.length, a + texto.length); });
  };

  const pedirSalvar = () => { setNome(atual?.nome ?? ""); setSalvando(true); setMsg(null); };

  const confirmarSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await salvarConsulta(nome, sql, atual?.id);
    if ("erro" in r) { setMsg(r.erro); return; }
    setSalvas(r.salvas);
    setAtual(r.salvas.find((s) => s.id === r.id) ?? null);
    setSalvando(false);
    setMsg("Salva");
    setTimeout(() => setMsg(null), 1500);
  };

  const excluir = async (s: Salva) => {
    setSalvas(await excluirConsulta(s.id));
    if (atual?.id === s.id) setAtual(null);
  };

  const compartilhar = async () => {
    const url = `${location.origin}/?q=${codificar(sql)}`;
    try { await navigator.clipboard.writeText(url); setMsg("Link copiado"); } catch { setMsg(url); }
    setTimeout(() => setMsg(null), 2000);
  };

  const f = filtro.trim().toLowerCase();
  const casa = (...textos: (string | null | undefined)[]) => !f || textos.some((t) => t?.toLowerCase().includes(f));

  return (
    <div className="bancada">
      <aside className="lateral" aria-label="Esquema e consultas">
        <div className="lateral-busca">
          <input className="campo" placeholder="Filtrar fontes, tabelas, colunas e consultas" value={filtro} onChange={(e) => setFiltro(e.target.value)} aria-label="Filtrar" />
        </div>

        {esquemas.map((e) => {
          const f = FONTES.find((x) => x.id === e.id)!;
          const tabelas = e.tabelas.filter((t) => casa(f.sigla, f.orgao, t.completo, t.descricao, ...t.colunas.map((c) => c.nome)));
          if (filtro && !tabelas.length) return null;
          return (
            <details key={e.id} className="grupo" open={e.id === "siconfi" || !!filtro}>
              <summary title={f.resumo}>
                <span className="fonte-cab"><span className="fonte-id">{e.id}</span><span className="fonte-orgao">{f.orgao}</span></span>
              </summary>
              <div className="grupo-corpo">
                {tabelas.map((t) => (
                  <details key={t.completo} open={!!filtro}>
                    <summary className="item" title={t.descricao ?? undefined}>
                      <span className="tabela-ico">{t.tipo === "view" ? "◇" : "▦"}</span>
                      <span className="item-nome mono">{t.nome}</span>
                      <span className="item-meta">{curto(t.linhas)}</span>
                    </summary>
                    {t.descricao && <span className="item-sub item-desc">{t.descricao}</span>}
                    <button className="item item-col" onClick={() => inserir(`SELECT *\nFROM ${t.esquema}.${/^[A-Za-z_]\w*$/.test(t.nome) ? t.nome : identificador(t.nome)}\nLIMIT 100`)} title="Inserir um SELECT desta tabela">
                      <span className="item-nome" style={{ color: "var(--acento-texto)" }}>SELECT * FROM {t.completo}</span>
                    </button>
                    <Link className="item item-col" href={`/tabelas/${encodeURIComponent(t.completo)}`}>
                      <span className="item-nome" style={{ color: "var(--muted)" }}>navegar e filtrar →</span>
                    </Link>
                    {t.colunas.filter((c) => casa(t.completo, c.nome, f.sigla)).map((c) => (
                      <button key={c.nome} className="item item-col" onClick={() => inserir(c.nome)} title={`Inserir ${c.nome}`}>
                        <span className="item-nome">{c.nome}</span>
                        <span className="item-meta">{c.tipo}{c.pk ? " · pk" : ""}</span>
                      </button>
                    ))}
                  </details>
                ))}
              </div>
            </details>
          );
        })}
        {ausentes.map((f) => (
          <div key={f.id} className="grupo fonte-ausente" title={`Sincronize com: ${f.sincronizar}`}>
            <span className="fonte-cab"><span className="fonte-id">{f.id}</span><span className="fonte-orgao">não sincronizado · {f.sincronizar}</span></span>
          </div>
        ))}

        <details className="grupo" open>
          <summary>Exemplos</summary>
          <div className="grupo-corpo">
            {exemplos.filter((e) => casa(e.titulo, e.descricao, e.sql, ...e.fontes)).map((e) => (
              <button key={e.id} className="item" onClick={() => abrir(e.sql)} title={e.descricao}>
                <span className="item-nome" style={{ whiteSpace: "normal" }}>
                  {e.titulo}
                  <span className="item-sub">{e.descricao}</span>
                  <span className="item-fontes">{e.fontes.map((f) => <code key={f}>{f}</code>)}</span>
                </span>
              </button>
            ))}
          </div>
        </details>

        <details className="grupo" open>
          <summary>Salvas · {salvas.length}</summary>
          <div className="grupo-corpo">
            {salvas.length === 0 && <span className="item-sub" style={{ padding: "0.3rem 0.4rem" }}>Nada salvo ainda. Ctrl+S no editor guarda a consulta aqui.</span>}
            {salvas.filter((s) => casa(s.nome, s.sql)).map((s) => (
              <div key={s.id} style={{ display: "flex" }}>
                <button className="item" onClick={() => abrir(s.sql, s)} aria-current={atual?.id === s.id}>
                  <span className="item-nome">{s.nome}</span>
                  <span className="item-meta">{tempoRelativo(s.atualizada)}</span>
                </button>
                <button className="item" style={{ width: "auto", color: "var(--faint)" }} onClick={() => excluir(s)} aria-label={`Excluir ${s.nome}`} title="Excluir">×</button>
              </div>
            ))}
          </div>
        </details>

        <details className="grupo">
          <summary>Histórico · {historico.length}</summary>
          <div className="grupo-corpo">
            {historico.filter((h) => casa(h.sql)).map((h) => (
              <button key={h.id} className="item" onClick={() => abrir(h.sql)} title={h.sql}>
                <span className="item-nome mono" style={{ fontSize: "0.75rem", color: h.erro ? "var(--erro)" : undefined }}>{h.sql.replace(/\s+/g, " ")}</span>
                <span className="item-meta">{h.erro ? "erro" : `${contagem(h.linhas ?? 0)} l.`}</span>
              </button>
            ))}
          </div>
        </details>
      </aside>

      <div className="principal">
        <div className="editor-barra">
          <button className="botao botao-primario" onClick={() => executar()} disabled={pendente}>
            {pendente ? "Executando…" : "Executar"} <span className="tecla">Ctrl ↵</span>
          </button>
          {salvando ? (
            <form className="salvar" onSubmit={confirmarSalvar}>
              <input className="campo" autoFocus placeholder="Nome da consulta" value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome da consulta" />
              <button className="botao" type="submit">{atual ? "Atualizar" : "Salvar"}</button>
              <button className="botao" type="button" onClick={() => setSalvando(false)}>Cancelar</button>
            </form>
          ) : (
            <button className="botao" onClick={pedirSalvar}>Salvar <span className="tecla">Ctrl S</span></button>
          )}
          <button className="botao" onClick={compartilhar}>Copiar link</button>
          {atual && !salvando && <button className="botao" onClick={() => { setAtual(null); setSql(""); campo.current?.focus(); }}>Nova</button>}
          <span className="espaco" />
          {msg && <span className="status">{msg}</span>}
          <span className="editor-titulo mudo">{atual ? atual.nome : "Consulta sem nome"}</span>
        </div>
        <Editor valor={sql} aoMudar={setSql} aoExecutar={executar} aoSalvar={pedirSalvar} campo={campo} />
        <Resultado resultado={resultado} sql={executado} pendente={pendente} />
      </div>
    </div>
  );
}
