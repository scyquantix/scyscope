"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconeCatalogo, IconeRelatorio, IconeSql } from "./icones";

// Rótulos do card do Scy Scope no site: consulta SQL, catálogo de fontes e os relatórios do SICONFI
const LINKS = [
  { href: "/", rotulo: "Consulta SQL", Icone: IconeSql, ativo: (p: string) => p === "/" },
  { href: "/tabelas", rotulo: "Catálogo", Icone: IconeCatalogo, ativo: (p: string) => p.startsWith("/tabelas") },
  { href: "/anexos", rotulo: "Relatórios", Icone: IconeRelatorio, ativo: (p: string) => p.startsWith("/anexos") },
];

export function Navegacao() {
  const caminho = usePathname();
  return (
    <nav className="nav" aria-label="Seções">
      {LINKS.map(({ href, rotulo, Icone, ativo }) => (
        <Link key={href} href={href} title={rotulo} aria-current={ativo(caminho) ? "page" : undefined}>
          <Icone />
          <span className="nav-rotulo">{rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
