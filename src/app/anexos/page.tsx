import type { Metadata } from "next";
import Link from "next/link";
import { dados } from "@/lib/esquema";
import { codificar, literal } from "@/lib/sql";
import { contagem } from "@/lib/formato";
import { FormAuto } from "@/components/form-auto";

export const metadata: Metadata = { title: "Relatórios" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

const ENTE = 3515707;
const API = "https://apidatalake.tesouro.gov.br/ords/siconfi/tt";
const nf = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Remonta um anexo do SICONFI como a matriz do relatório: contas nas linhas, colunas na ordem da API. */
export default async function Anexos({ searchParams }: Props) {
  const sp = await searchParams;
  const db = dados();
  const lista = <T,>(sql: string, ...a: (string | number)[]) => (db.prepare(sql).all(...a) as Record<string, T>[]).map((r) => Object.values(r)[0] as T);

  // Cada seletor depende do anterior; um valor que não existe mais cai no mais recente disponível
  const fontes = lista<string>("SELECT DISTINCT fonte FROM siconfi.linhas ORDER BY fonte DESC");
  const fonte = fontes.includes(sp.fonte ?? "") ? sp.fonte! : fontes[0];
  const anos = lista<number>("SELECT DISTINCT exercicio FROM siconfi.linhas WHERE fonte = ? ORDER BY 1 DESC", fonte);
  const ano = anos.includes(Number(sp.ano)) ? Number(sp.ano) : anos[0];
  const periodos = lista<number>("SELECT DISTINCT periodo FROM siconfi.linhas WHERE fonte = ? AND exercicio = ? ORDER BY 1 DESC", fonte, ano);
  const periodo = periodos.includes(Number(sp.periodo)) ? Number(sp.periodo) : periodos[0];
  const anexos = lista<string>("SELECT anexo FROM siconfi.linhas WHERE fonte = ? AND exercicio = ? AND periodo = ? GROUP BY anexo ORDER BY anexo", fonte, ano, periodo);
  const anexo = anexos.includes(sp.anexo ?? "") ? sp.anexo! : anexos[0];
  const busca = sp.busca?.trim() ?? "";

  const brutas = db
    .prepare("SELECT cod_conta, conta, coluna, valor FROM siconfi.linhas WHERE fonte = ? AND exercicio = ? AND periodo = ? AND anexo = ? ORDER BY rowid")
    .all(fonte, ano, periodo, anexo) as { cod_conta: string; conta: string; coluna: string; valor: number | null }[];

  const colunas: string[] = [];
  const linhas = new Map<string, { cod: string; conta: string; valores: Map<string, number | null> }>();
  for (const r of brutas) {
    if (!colunas.includes(r.coluna)) colunas.push(r.coluna);
    const chave = `${r.cod_conta}|${r.conta}`;
    if (!linhas.has(chave)) linhas.set(chave, { cod: r.cod_conta, conta: r.conta, valores: new Map() });
    const l = linhas.get(chave)!;
    if (!l.valores.has(r.coluna)) l.valores.set(r.coluna, r.valor);
  }
  const b = busca.toLowerCase();
  const visiveis = [...linhas.values()].filter((l) => !b || l.conta.toLowerCase().includes(b) || l.cod.toLowerCase().includes(b));

  const unidade = fonte === "RGF" ? "quadrimestre" : "bimestre";
  const apiParams = new URLSearchParams({ an_exercicio: String(ano), nr_periodo: String(periodo), co_tipo_demonstrativo: fonte, no_anexo: anexo, id_ente: String(ENTE) });
  if (fonte === "RGF") { apiParams.set("in_periodicidade", "Q"); apiParams.set("co_poder", "E"); }
  const sqlAnexo = `SELECT conta, coluna, valor, cod_conta\nFROM siconfi.linhas\nWHERE fonte = ${literal(fonte)} AND exercicio = ${ano} AND periodo = ${periodo}\n  AND anexo = ${literal(anexo)}${busca ? `\n  AND conta LIKE ${literal(`%${busca}%`)}` : ""}\nORDER BY rowid`;

  return (
    <main className="pagina">
      <div className="cab">
        <div>
          <span className="sobretitulo">siconfi · Anexo do RREO e do RGF</span>
          <h1>{anexo} · <em>{periodo}º {unidade} de {ano}</em></h1>
          <p>{contagem(visiveis.length)} contas × {colunas.length} colunas{busca ? ` contendo “${busca}”` : ""}, na ordem em que a API do SICONFI entrega. Contas em maiúsculas costumam ser totais e subtotais.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a className="botao" href={`${API}/${fonte.toLowerCase()}?${apiParams}`} target="_blank" rel="noreferrer">JSON na API ↗</a>
          <Link className="botao botao-primario" href={`/?q=${codificar(sqlAnexo)}`}>Abrir no editor</Link>
        </div>
      </div>

      <FormAuto action="/anexos" className="seletores">
        <label>Relatório
          <select className="seletor" name="fonte" defaultValue={fonte}>{fontes.map((f) => <option key={f} value={f}>{f}</option>)}</select>
        </label>
        <label>Ano
          <select className="seletor" name="ano" defaultValue={ano}>{anos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <label>{unidade[0].toUpperCase() + unidade.slice(1)}
          <select className="seletor" name="periodo" defaultValue={periodo}>{periodos.map((p) => <option key={p} value={p}>{p}º</option>)}</select>
        </label>
        <label>Anexo
          <select className="seletor" name="anexo" defaultValue={anexo}>{anexos.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        </label>
        <label>Conta contém
          <input className="campo" name="busca" defaultValue={busca} placeholder="ex.: FUNDEB" style={{ width: "14rem" }} />
        </label>
        <button className="botao" type="submit">Abrir</button>
      </FormAuto>

      <section className="cartao">
        <div className="rolagem" style={{ maxHeight: "calc(100dvh - 16rem)" }}>
          <table className="matriz">
            <thead>
              <tr><th>Conta</th>{colunas.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {visiveis.map((l) => {
                const total = l.conta === l.conta.toUpperCase() && /[A-Z]/.test(l.conta);
                return (
                  <tr key={`${l.cod}|${l.conta}`} data-total={total}>
                    <td>{l.conta}<span className="cod">{l.cod}</span></td>
                    {colunas.map((c) => {
                      const v = l.valores.get(c);
                      if (v == null) return <td key={c} className="vazia">·</td>;
                      return <td key={c} className={v < 0 ? "negativo" : undefined}>{nf.format(v)}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visiveis.length === 0 && <div className="vazio"><strong>Nenhuma conta encontrada</strong></div>}
        </div>
      </section>
    </main>
  );
}
