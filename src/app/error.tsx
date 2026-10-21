"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="pagina">
      <section className="cartao" style={{ maxWidth: "42rem" }}>
        <div className="cartao-cab"><h2>Não foi possível montar esta página</h2></div>
        <div className="cartao-corpo" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p className="erro" style={{ margin: 0 }}>{error.message}</p>
          <p className="mudo">O ScyScope lê uma base por fonte. Rode <span className="mono">npm run sync</span> para baixar as fontes (SICONFI, IBGE, BACEN e TCE-SP).</p>
          <div><button className="botao" onClick={reset}>Tentar de novo</button></div>
        </div>
      </section>
    </main>
  );
}
