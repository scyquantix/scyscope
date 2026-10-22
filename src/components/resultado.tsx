"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Resultado as R, Valor } from "@/lib/executar";
import { codificar } from "@/lib/sql";
import { contagem, cru, ms, numero } from "@/lib/formato";
import { LogoSimbolo } from "./logo";

type Aba = "tabela" | "grafico" | "plano";
const LOTE = 500;

export function Resultado({ resultado, sql, pendente }: { resultado: R | null; sql: string; pendente: boolean }) {
  const [aba, setAba] = useState<Aba>("tabela");
  const [formatado, setFormatado] = useState(true);
  const [ordem, setOrdem] = useState<{ col: number; dir: 1 | -1 } | null>(null);
  const [visiveis, setVisiveis] = useState(LOTE);
  const [copiado, setCopiado] = useState(false);

  // Resultado novo: volta ao começo
  useEffect(() => { setOrdem(null); setVisiveis(LOTE); }, [resultado]);

  const numericas = useMemo(() => {
    if (!resultado?.ok) return [];
    return resultado.colunas.map((_, j) => {
      let algum = false;
      for (const l of resultado.linhas) { const v = l[j]; if (v == null) continue; if (typeof v !== "number") return false; algum = true; }
      return algum;
    });
  }, [resultado]);

  const linhas = useMemo(() => {
    if (!resultado?.ok) return [];
    const idx = resultado.linhas.map((l, i) => ({ l, i }));
    if (ordem) {
      idx.sort((a, b) => {
        const x = a.l[ordem.col], y = b.l[ordem.col];
        if (x == null) return 1;
        if (y == null) return -1;
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "pt-BR", { numeric: true })) * ordem.dir;
      });
    }
    return idx;
  }, [resultado, ordem]);

  const ordenar = (col: number) =>
    setOrdem((o) => (!o || o.col !== col ? { col, dir: 1 } : o.dir === 1 ? { col, dir: -1 } : null));

  const copiar = async () => {
    if (!resultado?.ok) return;
    const tsv = [resultado.colunas.map((c) => c.nome), ...linhas.map(({ l }) => l.map(cru))].map((r) => r.join("\t")).join("\n");
    try { await navigator.clipboard.writeText(tsv); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch {}
  };

  const celula = (v: Valor, j: number) => {
    if (v == null) return <td key={j} className="nulo">NULL</td>;
    if (typeof v === "number") return <td key={j} data-numerica="true">{formatado ? numero(v) : String(v)}</td>;
    return <td key={j} title={v.length > 60 ? v : undefined} data-numerica={numericas[j] || undefined}>{v}</td>;
  };

  return (
    <section className="resultado" aria-label="Resultado">
      <div className="resultado-barra">
        <div className="abas" role="tablist">
          {(["tabela", "grafico", "plano"] as const).map((a) => (
            <button key={a} role="tab" aria-selected={aba === a} onClick={() => setAba(a)}>
              {{ tabela: "Tabela", grafico: "Gráfico", plano: "Plano" }[a]}
            </button>
          ))}
        </div>
        <span className="status" aria-live="polite">
          {pendente ? "Executando…" : resultado?.ok ? <><b>{contagem(resultado.linhas.length)}</b>{resultado.cortado ? "+" : ""} linhas · {resultado.colunas.length} colunas · {ms(resultado.ms)}</> : resultado ? `erro · ${ms(resultado.ms)}` : ""}
        </span>
        <span className="espaco" />
        {resultado?.ok && aba === "tabela" && (
          <>
            <label className="alternar"><input type="checkbox" checked={formatado} onChange={(e) => setFormatado(e.target.checked)} />Números formatados</label>
            <button className="botao" onClick={copiar}>{copiado ? "Copiado" : "Copiar"}</button>
            <a className="botao" href={`/api/exportar?q=${codificar(sql)}`} download>CSV</a>
          </>
        )}
      </div>

      <div className="resultado-corpo">
        {!resultado && !pendente && <div className="vazio vazio-marca"><LogoSimbolo aria-hidden /><strong>Nenhuma consulta executada</strong><span>Escreva um SELECT e tecle Ctrl+Enter, ou escolha um exemplo à esquerda.</span><span className="assinatura">Tecnologia orientada por evidências</span></div>}
        {resultado && !resultado.ok && <div className="erro">{resultado.erro}</div>}
        {resultado?.ok && resultado.cortado && <div className="aviso">Mostrando as primeiras {contagem(resultado.linhas.length)} linhas. O CSV traz o resultado completo, até 200 mil linhas.</div>}

        {resultado?.ok && aba === "tabela" && (
          resultado.linhas.length === 0 ? <div className="vazio"><strong>A consulta não devolveu linhas</strong></div> : (
            <>
              <table className="grade">
                <thead>
                  <tr>
                    <th className="n-linha">#</th>
                    {resultado.colunas.map((c, j) => (
                      <th key={j} data-numerica={numericas[j]} aria-sort={ordem?.col === j ? (ordem.dir === 1 ? "ascending" : "descending") : "none"}>
                        <button onClick={() => ordenar(j)} title={c.tabela ? `${c.tabela}.${c.coluna}` : "Expressão calculada"}>
                          <span>{c.nome}{ordem?.col === j ? (ordem.dir === 1 ? " ↑" : " ↓") : ""}</span>
                          <span className="tipo">{c.tipo ?? (numericas[j] ? "número" : "expressão")}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {linhas.slice(0, visiveis).map(({ l, i }) => (
                    <tr key={i}><td className="n-linha">{i + 1}</td>{l.map(celula)}</tr>
                  ))}
                </tbody>
              </table>
              {linhas.length > visiveis && (
                <div className="mais"><button className="botao" onClick={() => setVisiveis((v) => v + LOTE)}>Mostrar mais {contagem(Math.min(LOTE, linhas.length - visiveis))} de {contagem(linhas.length - visiveis)}</button></div>
              )}
            </>
          )
        )}

        {resultado?.ok && aba === "grafico" && <GraficoResultado key={resultado.colunas.map((c) => c.nome).join("|")} resultado={resultado} numericas={numericas} />}

        {resultado?.ok && aba === "plano" && (
          <div className="plano">
            {(resultado.plano ?? []).map((p) => {
              const nivel = profundidade(resultado.plano!, p.id);
              const cls = /^SCAN/.test(p.detalhe) ? "scan" : /USING (COVERING )?INDEX/.test(p.detalhe) ? "indice" : undefined;
              return <div key={p.id} className={cls}>{"  ".repeat(nivel)}{nivel ? "└ " : ""}{p.detalhe}</div>;
            })}
            <p className="fraco" style={{ marginTop: "0.75rem", fontFamily: "var(--font-sans)" }}>SCAN lê a tabela inteira; SEARCH … USING INDEX usa um índice. Em tabelas grandes, filtre por colunas indexadas (fonte, exercicio, periodo, anexo, cod_conta).</p>
          </div>
        )}
      </div>
    </section>
  );
}

function profundidade(plano: { id: number; pai: number }[], id: number): number {
  let n = 0;
  let atual = plano.find((p) => p.id === id);
  while (atual && atual.pai !== 0 && n < 20) { atual = plano.find((p) => p.id === atual!.pai); n++; }
  return n;
}

// ---------- Gráfico do resultado ----------

const SERIES = ["var(--serie-1)", "var(--serie-2)", "var(--serie-3)", "var(--serie-4)", "var(--serie-5)"];
const MAX_PONTOS = 300;

function GraficoResultado({ resultado, numericas }: { resultado: Extract<R, { ok: true }>; numericas: boolean[] }) {
  const cols = resultado.colunas;
  const textuais = cols.map((_, j) => j).filter((j) => !numericas[j]);
  const nums = cols.map((_, j) => j).filter((j) => numericas[j]);
  // Eixo X padrão: a primeira coluna de texto; sem nenhuma, a primeira coluna (ex.: ano)
  const [x, setX] = useState<number>(textuais[0] ?? 0);
  const [ys, setYs] = useState<number[]>(nums.filter((j) => j !== (textuais[0] ?? 0)).slice(0, 3));
  const [tipo, setTipo] = useState<"barras" | "linha">("barras");
  const caixa = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  const [foco, setFoco] = useState<number | null>(null);

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { const w = Math.floor(e.contentRect.width); if (w > 0) setW(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!nums.length) return <div className="vazio"><strong>Sem colunas numéricas para desenhar</strong><span>O gráfico precisa de ao menos uma coluna só com números.</span></div>;

  const pontos = resultado.linhas.slice(0, MAX_PONTOS);
  const rotulo = (l: Valor[]) => cru(l[x]);
  const valores = pontos.flatMap((l) => ys.map((j) => l[j])).filter((v): v is number => typeof v === "number");
  const maxV = Math.max(0, ...valores), minV = Math.min(0, ...valores);
  const H = 300, mt = 10, mb = 40;
  const passo0 = (maxV - minV || 1) / 4;
  const mag = 10 ** Math.floor(Math.log10(passo0));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((p) => p >= passo0)!;
  const base = Math.floor(minV / passo) * passo, topo = Math.ceil(maxV / passo) * passo || passo;
  const ticks: number[] = [];
  for (let t = base; t <= topo + passo / 2; t += passo) ticks.push(Math.round(t * 1e9) / 1e9);
  const fmtEixo = (v: number) => (Math.abs(v) >= 1e6 ? `${numero(Math.round(v / 1e5) / 10)} mi` : numero(v));
  const ml = Math.max(...ticks.map((t) => fmtEixo(t).length)) * 6.6 + 12;
  const larg = W - ml - 8;
  const banda = larg / Math.max(1, pontos.length);
  const y = (v: number) => mt + (1 - (v - base) / (topo - base)) * (H - mt - mb);
  const xc = (i: number) => ml + i * banda + banda / 2;
  const pular = Math.max(1, Math.ceil(pontos.length / Math.max(1, Math.floor(larg / 64))));

  return (
    <>
      <div className="grafico-opcoes">
        <label>Eixo X
          <select className="seletor" value={x} onChange={(e) => setX(Number(e.target.value))}>
            {cols.map((c, j) => <option key={j} value={j}>{c.nome}</option>)}
          </select>
        </label>
        <span className="pilulas" role="group" aria-label="Séries">
          {nums.filter((j) => j !== x).map((j) => {
            const ativo = ys.includes(j);
            const cor = SERIES[ys.indexOf(j) % SERIES.length];
            return (
              <button key={j} className="pilula" aria-pressed={ativo} onClick={() => setYs((s) => (ativo ? s.filter((k) => k !== j) : [...s, j]))}>
                {ativo && <i style={{ background: cor }} />}{cols[j].nome}
              </button>
            );
          })}
        </span>
        <span className="pilulas" role="group" aria-label="Tipo">
          {(["barras", "linha"] as const).map((t) => <button key={t} className="pilula" aria-pressed={tipo === t} onClick={() => setTipo(t)}>{t === "barras" ? "Barras" : "Linha"}</button>)}
        </span>
        {resultado.linhas.length > MAX_PONTOS && <span className="fraco">Primeiras {MAX_PONTOS} linhas</span>}
      </div>
      <div className="grafico" ref={caixa} onMouseLeave={() => setFoco(null)}>
        {ys.length === 0 ? <div className="vazio">Escolha ao menos uma série.</div> : (
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${ys.map((j) => cols[j].nome).join(", ")} por ${cols[x].nome}`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={ml} x2={W - 8} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--linha-forte)" : "var(--linha)"} />
                <text x={ml - 8} y={y(t)} dy="0.32em" textAnchor="end">{fmtEixo(t)}</text>
              </g>
            ))}
            {pontos.map((l, i) => i % pular === 0 && (
              <text key={i} x={xc(i)} y={H - mb + 16} textAnchor="middle">{rotulo(l).length > 12 ? rotulo(l).slice(0, 11) + "…" : rotulo(l)}</text>
            ))}
            {foco != null && <rect x={ml + foco * banda} width={banda} y={mt} height={H - mt - mb} fill="var(--painel-2)" />}
            {tipo === "barras"
              ? pontos.map((l, i) => ys.map((j, k) => {
                  const v = l[j];
                  if (typeof v !== "number") return null;
                  const w = (banda * 0.75) / ys.length;
                  const x0 = ml + i * banda + banda * 0.125 + k * w;
                  return <rect key={`${i}-${j}`} x={x0} width={Math.max(1, w - 1)} y={Math.min(y(v), y(0))} height={Math.abs(y(0) - y(v))} rx={2} fill={SERIES[k % SERIES.length]} />;
                }))
              : ys.map((j, k) => {
                  let d = "", aberto = false;
                  pontos.forEach((l, i) => { const v = l[j]; if (typeof v !== "number") { aberto = false; return; } d += `${aberto ? "L" : "M"}${xc(i)},${y(v)}`; aberto = true; });
                  return <path key={j} d={d} fill="none" stroke={SERIES[k % SERIES.length]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
                })}
            {pontos.map((_, i) => <rect key={`h${i}`} x={ml + i * banda} width={banda} y={0} height={H} fill="transparent" onMouseEnter={() => setFoco(i)} />)}
          </svg>
        )}
        {foco != null && ys.length > 0 && (
          <div className="dica" style={{ top: 16, ...((xc(foco) / W) > 0.6 ? { right: W - xc(foco) + 12 } : { left: xc(foco) + 12 }) }}>
            <div className="fraco">{rotulo(pontos[foco])}</div>
            {ys.map((j, k) => <div key={j}><i style={{ background: SERIES[k % SERIES.length] }} />{cols[j].nome}: <b>{pontos[foco][j] == null ? "NULL" : numero(Number(pontos[foco][j]))}</b></div>)}
          </div>
        )}
      </div>
    </>
  );
}
