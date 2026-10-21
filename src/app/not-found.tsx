import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="pagina">
      <section className="cartao" style={{ maxWidth: "36rem" }}>
        <div className="cartao-cab"><h2>Não encontrado</h2></div>
        <div className="cartao-corpo"><p className="mudo">Essa tabela ou página não existe. As tabelas se chamam esquema.tabela, como siconfi.linhas. <Link href="/tabelas">Ver o catálogo</Link>.</p></div>
      </section>
    </main>
  );
}
