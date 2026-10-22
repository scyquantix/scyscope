import { Logo, LogoSimbolo } from "@/components/logo";

// Telas de login no desenho do site da ScyQuantix: cabeçalho branco com o logo oficial, painel em azul profundo com
// grade técnica, brilho ciano e o símbolo (o topo da landing) e o formulário ao lado. O título do produto repete o card
// do Scy Scope no site: lupa ciano e "Scy Scope" com "Scope" em ciano.
// As cores são as da marca e não seguem o tema claro/escuro, como no site.
export default function LayoutAcesso({ children }: { children: React.ReactNode }) {
  return (
    <div className="acesso">
      <header className="acesso-topo">
        <a href="https://scyquantix.com" aria-label="ScyQuantix, página inicial"><Logo /></a>
      </header>
      <section className="vitrine">
        <div className="vitrine-simbolo" aria-hidden="true"><LogoSimbolo /></div>
        <div className="vitrine-texto">
          <p className="sobretitulo">Tecnologia orientada por evidências</p>
          <h1>Explore dados públicos do Brasil <em>com SQL.</em></h1>
          <p>SICONFI, TCE-SP, IBGE e BACEN, cada fonte num esquema, cruzadas numa mesma consulta.</p>
        </div>
        <p className="vitrine-lema">Método, clareza e valor real.</p>
      </section>
      <main className="acesso-painel">
        <div className="acesso-cartao">
          <p className="produto">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.34-4.34" /></svg>
            <span>Scy <em>Scope</em></span>
          </p>
          {children}
        </div>
        <p className="assinatura">ScyQuantix · scyquantix.com</p>
      </main>
    </div>
  );
}
