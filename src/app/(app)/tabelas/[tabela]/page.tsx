import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dados, origem, tabela as buscarTabela, type Tabela } from "@/lib/esquema";
import { fonte } from "@/lib/fontes";
import { codificar, identificador, literal } from "@/lib/sql";
import { contagem, numero } from "@/lib/formato";
import { exigirUsuario } from "@/lib/sessao";

export const dynamic = "force-dynamic";

type Busca = Record<string, string | string[] | undefined>;
type Props = { params: Promise<{ tabela: string }>; searchParams: Promise<Busca> };

const POR_PAGINA = 50;
const MAX_FACETA = 60; // colunas com até tantos valores distintos viram faceta
const NULO = "∅";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).tabela) };
}

type Filtro = { coluna: string; valor: string };

const candidatas = new Map<string, { linhas: number; colunas: string[] }>();

/** Colunas com poucos valores distintos na tabela inteira; recalcula se a tabela mudar de tamanho. */
function candidatasFaceta(t: Tabela): string[] {
  const guardado = candidatas.get(t.completo);
  if (guardado && guardado.linhas === t.linhas) return guardado.colunas;
  const db = dados();
  const colunas = t.colunas
    .filter((c) => (db.prepare(`SELECT COUNT(*) n FROM (SELECT DISTINCT ${identificador(c.nome)} FROM ${origem(t)} LIMIT ${MAX_FACETA + 1})`).get() as { n: number }).n <= MAX_FACETA)
    .map((c) => c.nome);
  candidatas.set(t.completo, { linhas: t.linhas, colunas });
  return colunas;
}

/** Lê o estado da URL e o traduz numa cláusula WHERE com parâmetros. */
function montar(t: Tabela, sp: Busca) {
  const um = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) as string | undefined;
  const filtros: Filtro[] = Object.entries(sp)
    .filter(([k]) => k.startsWith("f.") && t.colunas.some((c) => c.nome === k.slice(2)))
    .map(([k, v]) => ({ coluna: k.slice(2), valor: String(Array.isArray(v) ? v[0] : v) }));
  const busca = um("busca")?.trim() || "";
  const tipo = (col: string) => t.colunas.find((c) => c.nome === col)?.tipo.toUpperCase() ?? "";
  const valorTipado = (col: string, v: string) => (/INT|REAL|NUM/.test(tipo(col)) && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : v);

  const cond: string[] = [];
  const args: (string | number)[] = [];
  const condSql: string[] = []; // a mesma condição com literais, para "abrir no editor"
  for (const f of filtros) {
    if (f.valor === NULO) { cond.push(`${identificador(f.coluna)} IS NULL`); condSql.push(`${f.coluna} IS NULL`); continue; }
    const v = valorTipado(f.coluna, f.valor);
    cond.push(`${identificador(f.coluna)} = ?`); args.push(v); condSql.push(`${f.coluna} = ${literal(v)}`);
  }
  const textuais = t.colunas.filter((c) => /TEXT|CHAR|^—$/.test(c.tipo.toUpperCase()));
  if (busca && textuais.length) {
    cond.push(`(${textuais.map((c) => `${identificador(c.nome)} LIKE ?`).join(" OR ")})`);
    textuais.forEach(() => args.push(`%${busca}%`));
    condSql.push(`(${textuais.map((c) => `${c.nome} LIKE ${literal(`%${busca}%`)}`).join(" OR ")})`);
  }
  const ordem = t.colunas.some((c) => c.nome === um("ordem")) ? um("ordem")! : null;
  const dir = um("dir") === "desc" ? "DESC" : "ASC";
  const pagina = Math.max(1, Number(um("pagina")) || 1);
  const col = t.colunas.some((c) => c.nome === um("col")) ? um("col")! : null;
  return { filtros, busca, cond, args, condSql, ordem, dir, pagina, col, valorTipado };
}

export default async function NavegarTabela({ params, searchParams }: Props) {
  await exigirUsuario();
  const nome = decodeURIComponent((await params).tabela);
  const t = buscarTabela(nome);
  if (!t) notFound();
  const sp = await searchParams;
  const m = montar(t, sp);
  const db = dados();
  const from = origem(t);
  const where = m.cond.length ? `WHERE ${m.cond.join(" AND ")}` : "";

  const total = (db.prepare(`SELECT COUNT(*) n FROM ${from} ${where}`).get(...m.args) as { n: number }).n;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(m.pagina, paginas);
  const ordemSql = m.ordem ? `ORDER BY ${identificador(m.ordem)} ${m.dir}` : "ORDER BY rowid";
  const stmt = db.prepare(`SELECT * FROM ${from} ${where} ${ordemSql} LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`);
  stmt.setReturnArrays(true);
  const linhas = stmt.all(...m.args) as unknown as (string | number | null)[][];

  // Facetas: valores e contagens de cada coluna de baixa cardinalidade, sob os filtros ativos.
  // Quais colunas são candidatas se decide uma vez pela cardinalidade sem filtro; cada faceta é um GROUP BY só.
  const facetas = candidatasFaceta(t)
    .map((coluna) => {
      const id = identificador(coluna);
      const grupos = db.prepare(`SELECT ${id} v, COUNT(*) n FROM ${from} ${where} GROUP BY 1 ORDER BY n DESC, v LIMIT ${MAX_FACETA + 1}`).all(...m.args) as { v: string | number | null; n: number }[];
      if (!grupos.length || grupos.length > MAX_FACETA) return null;
      return { coluna, distintos: grupos.length, valores: grupos.slice(0, 30) };
    })
    .filter((f): f is NonNullable<typeof f> => !!f);

  // Estatísticas da coluna escolhida
  let stats: { n: number; nulos: number; distintos: number; min: unknown; max: unknown; media: number | null; topo: { v: string | number | null; n: number }[] } | null = null;
  if (m.col) {
    const id = identificador(m.col);
    const r = db.prepare(`SELECT COUNT(*) n, SUM(${id} IS NULL) nulos, COUNT(DISTINCT ${id}) distintos, MIN(${id}) min, MAX(${id}) max,
      AVG(CASE WHEN typeof(${id}) IN ('integer','real') THEN ${id} END) media FROM ${from} ${where}`).get(...m.args) as Record<string, number>;
    const topo = db.prepare(`SELECT ${id} v, COUNT(*) n FROM ${from} ${where} GROUP BY 1 ORDER BY n DESC LIMIT 10`).all(...m.args) as { v: string | number | null; n: number }[];
    stats = { n: r.n, nulos: r.nulos ?? 0, distintos: r.distintos, min: r.min, max: r.max, media: r.media ?? null, topo };
  }

  // Monta links preservando o estado da URL
  const atual = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v != null) atual.set(k, Array.isArray(v) ? v[0] : v);
  const link = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams(atual);
    for (const [k, v] of Object.entries(mudar)) (v == null ? p.delete(k) : p.set(k, v));
    if (!("pagina" in mudar)) p.delete("pagina");
    const s = p.toString();
    return `/tabelas/${encodeURIComponent(t.completo)}${s ? `?${s}` : ""}`;
  };
  const valorUrl = (v: string | number | null) => (v == null ? NULO : String(v));
  const fmt = (v: unknown) => (v == null ? "NULL" : typeof v === "number" ? numero(v) : String(v));

  const sqlEditor = `SELECT *\nFROM ${t.completo}${m.condSql.length ? `\nWHERE ${m.condSql.join("\n  AND ")}` : ""}\n${m.ordem ? `ORDER BY ${m.ordem} ${m.dir}` : ""}\nLIMIT 1000`.replace(/\n\n/, "\n");
  const numericas = t.colunas.map((c) => /INT|REAL|NUM/.test(c.tipo.toUpperCase()));

  return (
    <main className="pagina">
      <div className="cab">
        <div>
          <div className="migalha"><Link href="/tabelas">Catálogo</Link><span>/</span><Link href={`/tabelas#fonte-${t.esquema}`}>{fonte(t.esquema)?.sigla}</Link><span>/</span></div>
          <h1 className="mono"><span className="fraco">{t.esquema}.</span>{t.nome}</h1>
          {t.descricao && <p>{t.descricao}</p>}
          <p>{contagem(total)} de {contagem(t.linhas)} linhas{m.filtros.length || m.busca ? " com os filtros abaixo" : ""}.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <form action={`/tabelas/${encodeURIComponent(t.completo)}`} style={{ display: "flex", gap: "0.4rem" }}>
            {m.filtros.map((f) => <input key={f.coluna} type="hidden" name={`f.${f.coluna}`} value={f.valor} />)}
            <input className="campo" name="busca" defaultValue={m.busca} placeholder="Buscar no texto" aria-label="Buscar nas colunas de texto" style={{ width: "16rem" }} />
            <button className="botao" type="submit">Buscar</button>
          </form>
          <Link className="botao botao-primario" href={`/?q=${codificar(sqlEditor)}`}>Abrir no editor</Link>
        </div>
      </div>

      {(m.filtros.length > 0 || m.busca) && (
        <div className="filtros-ativos">
          {m.filtros.map((f) => <Link key={f.coluna} className="filtro" href={link({ [`f.${f.coluna}`]: null })}>{f.coluna} = {f.valor} ×</Link>)}
          {m.busca && <Link className="filtro" href={link({ busca: null })}>contém “{m.busca}” ×</Link>}
          <Link className="fraco" href={`/tabelas/${encodeURIComponent(t.completo)}`} style={{ fontSize: "0.75rem" }}>limpar tudo</Link>
        </div>
      )}

      <div className="navegador">
        <aside className="facetas" aria-label="Facetas">
          {facetas.map((f) => {
            const max = Math.max(...f.valores.map((v) => v.n));
            const filtrado = m.filtros.find((x) => x.coluna === f.coluna);
            return (
              <section key={f.coluna} className="cartao faceta">
                <h3><span>{f.coluna}</span><span className="fraco">{f.distintos} valores</span></h3>
                <ul>
                  {f.valores.map((v) => {
                    const ativo = filtrado?.valor === valorUrl(v.v);
                    return (
                      <li key={valorUrl(v.v)}>
                        <Link href={link({ [`f.${f.coluna}`]: ativo ? null : valorUrl(v.v) })} aria-current={ativo}>
                          <i className="barrinha" style={{ width: `${(v.n / max) * 100}%` }} />
                          <span className={v.v == null ? "fraco" : undefined}>{v.v == null ? "NULL" : String(v.v)}</span>
                          <span>{contagem(v.n)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <section className="cartao faceta">
            <h3><span>Inspecionar coluna</span></h3>
            <ul>
              {t.colunas.map((c) => (
                <li key={c.nome}><Link href={link({ col: m.col === c.nome ? null : c.nome })} aria-current={m.col === c.nome}><span className="mono">{c.nome}</span><span>{c.tipo.toLowerCase()}</span></Link></li>
              ))}
            </ul>
          </section>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
          {stats && m.col && (
            <section className="cartao">
              <div className="cartao-cab"><h2>Coluna <span className="mono">{m.col}</span></h2><Link className="fraco" href={link({ col: null })}>fechar</Link></div>
              <div className="stats">
                <div><span>Linhas</span><b>{contagem(stats.n)}</b></div>
                <div><span>Nulos</span><b>{contagem(stats.nulos)}</b></div>
                <div><span>Distintos</span><b>{contagem(stats.distintos)}</b></div>
                <div><span>Mínimo</span><b title={fmt(stats.min)}>{fmt(stats.min)}</b></div>
                <div><span>Máximo</span><b title={fmt(stats.max)}>{fmt(stats.max)}</b></div>
                {stats.media != null && <div><span>Média</span><b>{numero(Math.round(stats.media * 100) / 100)}</b></div>}
              </div>
              <div className="cartao-corpo" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <span className="fraco" style={{ fontSize: "0.75rem", width: "100%" }}>Valores mais frequentes (clique para filtrar)</span>
                {stats.topo.map((v) => (
                  <Link key={valorUrl(v.v)} className="etiqueta" href={link({ [`f.${m.col}`]: valorUrl(v.v), col: null })} style={{ textDecoration: "none" }}>
                    {v.v == null ? "NULL" : String(v.v).slice(0, 60)} · {contagem(v.n)}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="cartao">
            <div className="rolagem">
              <table className="grade">
                <thead>
                  <tr>
                    {t.colunas.map((c, j) => {
                      const ativa = m.ordem === c.nome;
                      const prox = !ativa ? "asc" : m.dir === "ASC" ? "desc" : null;
                      return (
                        <th key={c.nome} data-numerica={numericas[j]} aria-sort={ativa ? (m.dir === "ASC" ? "ascending" : "descending") : "none"}>
                          <Link href={link({ ordem: prox ? c.nome : null, dir: prox === "desc" ? "desc" : null })} style={{ display: "flex", flexDirection: "column", padding: "0.4rem 0.6rem", textDecoration: "none", alignItems: numericas[j] ? "flex-end" : "flex-start" }}>
                            <span>{c.nome}{ativa ? (m.dir === "ASC" ? " ↑" : " ↓") : ""}</span>
                            <span className="tipo">{c.tipo.toLowerCase()}</span>
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l, i) => (
                    <tr key={i}>
                      {l.map((v, j) => v == null
                        ? <td key={j} className="nulo">NULL</td>
                        : <td key={j} data-numerica={typeof v === "number" || undefined} title={typeof v === "string" && v.length > 60 ? v : undefined}>{typeof v === "number" ? numero(v) : v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
              {linhas.length === 0 && <div className="vazio"><strong>Nenhuma linha com estes filtros</strong></div>}
            </div>
            <div className="paginacao">
              <span className="mudo num">Página {contagem(pagina)} de {contagem(paginas)} · {contagem(total)} linhas</span>
              <span style={{ display: "flex", gap: "0.4rem" }}>
                {pagina > 1 ? <Link className="botao" href={link({ pagina: "1" })}>« Primeira</Link> : null}
                {pagina > 1 ? <Link className="botao" href={link({ pagina: String(pagina - 1) })}>‹ Anterior</Link> : null}
                {pagina < paginas ? <Link className="botao" href={link({ pagina: String(pagina + 1) })}>Próxima ›</Link> : null}
                {pagina < paginas ? <Link className="botao" href={link({ pagina: String(paginas) })}>Última »</Link> : null}
              </span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
