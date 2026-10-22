import type { Metadata } from "next";
import Link from "next/link";
import { esquemas, fontesAusentes } from "@/lib/esquema";
import { FONTES } from "@/lib/fontes";
import { bytes, contagem, dataHora } from "@/lib/formato";
import { exigirUsuario } from "@/lib/sessao";

export const metadata: Metadata = { title: "Catálogo" };
export const dynamic = "force-dynamic";

export default async function Tabelas() {
  await exigirUsuario();
  const lista = esquemas();
  const ausentes = fontesAusentes();
  return (
    <main className="pagina">
      <div className="cab">
        <div>
          <span className="sobretitulo">Catálogo</span>
          <h1>Fontes de <em>dados públicos</em></h1>
          <p>Cada API pública é um esquema SQL com o próprio nome: <span className="mono">siconfi.linhas</span>, <span className="mono">tce.despesas</span>, <span className="mono">ibge.populacao</span>, <span className="mono">bacen.ipca</span>. Consultas podem cruzar esquemas com JOIN.</p>
        </div>
      </div>

      {lista.map((e) => {
        const f = FONTES.find((x) => x.id === e.id)!;
        return (
          <section key={e.id} className="fonte-bloco" aria-labelledby={`fonte-${e.id}`}>
            <div className="fonte-bloco-cab">
              <div>
                <h2 id={`fonte-${e.id}`}><span className="mono fonte-id-grande">{e.id}</span> <span className="fonte-sigla">{f.sigla} · {f.orgao}</span></h2>
                <p className="mudo">{f.resumo}</p>
              </div>
              <div className="fonte-meta">
                <span>{bytes(e.bytes)} · atualizado em {dataHora(e.modificado)}</span>
                <a href={f.documentacao} target="_blank" rel="noreferrer">documentação da API ↗</a>
              </div>
            </div>
            <div className="lista-tabelas">
              {e.tabelas.map((t) => (
                <Link key={t.completo} href={`/tabelas/${encodeURIComponent(t.completo)}`} className="cartao ficha">
                  <div className="ficha-topo">
                    <h3 className="mono"><span className="fraco">{t.esquema}.</span>{t.nome}</h3>
                    <span className="mudo num">{contagem(t.linhas)} {t.linhas === 1 ? "linha" : "linhas"}</span>
                  </div>
                  {t.descricao && <p className="mudo" style={{ fontSize: "0.8125rem" }}>{t.descricao}</p>}
                  <div className="ficha-colunas">
                    {t.colunas.map((c) => <span key={c.nome} className="etiqueta">{c.nome}</span>)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {ausentes.length > 0 && (
        <section className="cartao cartao-corpo">
          <p className="mudo">Ainda sem dados: {ausentes.map((f) => <span key={f.id}><span className="mono">{f.id}</span> ({f.sincronizar}) </span>)}</p>
        </section>
      )}
    </main>
  );
}
