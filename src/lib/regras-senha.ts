// Regras da senha nova, usadas pelo servidor (acesso.ts) e pelo medidor de força no navegador (form-acesso.tsx).
// Ficam num só lugar para o medidor nunca mostrar como aceita uma senha que o servidor recusa, e vice-versa.
// A única regra que o navegador não confere é "diferente da senha atual": ela depende do hash e é checada no envio.

export const SENHA_MIN = 10;
export const SENHA_MAX = 200;

/** Motivo da recusa da senha, ou null se ela cumpre as regras. */
export function motivoRecusa(senha: string, login: string): string | null {
  if (senha.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  if (!/\p{L}/u.test(senha) || !/\d/.test(senha)) return "Use letras e números.";
  if (login && senha.toLowerCase().includes(login.toLowerCase())) return "A senha não pode conter o seu login.";
  return null;
}

export const NIVEIS_FORCA = ["Incompatível", "Fraca", "Razoável", "Boa", "Forte"] as const;

const COMUNS = ["senha", "password", "scyscope", "scyquantix", "qwerty", "123456", "abcdef", "admin", "brasil"];

/**
 * Força de 0 a 4, índice de NIVEIS_FORCA. 0 é só para a senha que o servidor recusa; uma senha aceita vale no mínimo
 * 1 (Fraca). Somam pontos o comprimento (10, 14 e 18 caracteres) e a variedade (minúsculas, maiúsculas, números,
 * símbolos); descontam sequências, repetições, palavras comuns e poucos caracteres distintos.
 */
export function forcaSenha(senha: string, login: string): number {
  if (motivoRecusa(senha, login)) return 0;
  const minus = senha.toLowerCase();
  const classes = [/\p{Ll}/u, /\p{Lu}/u, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(senha)).length;
  let p = 0;
  if (senha.length >= 10) p++;
  if (senha.length >= 14) p++;
  if (classes >= 3) p++;
  if (classes === 4 || senha.length >= 18) p++;
  if (/(.)\1\1/u.test(senha)) p--;
  if (/012|123|234|345|456|567|678|789|abc|bcd|cde|xyz|qwe|asd/.test(minus)) p--;
  if (COMUNS.some((c) => minus.includes(c))) p--;
  if (new Set(senha).size < senha.length / 2) p--;
  return Math.max(1, Math.min(4, p));
}
