import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO } from "@/lib/cookie";

/**
 * Checagem otimista: sem o cookie de sessão, manda para /entrar (ou 401 na API) antes de renderizar.
 * A validação de verdade (sessão aberta, não expirada, senha já trocada) fica em exigirUsuario(), em cada página e ação.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has(COOKIE_SESSAO)) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return new NextResponse("Sessão necessária.", { status: 401 });
  const url = new URL("/entrar", req.url);
  if (pathname !== "/") url.searchParams.set("de", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!entrar|_next/static|_next/image|icon.svg|favicon.ico).*)"],
};
