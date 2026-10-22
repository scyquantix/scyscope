import "server-only";
import { randomBytes, scrypt, scryptSync, timingSafeEqual, type ScryptOptions } from "node:crypto";

// scrypt do próprio Node, sem dependência nativa. N = 2^15 leva cerca de 0,45 s por senha numa máquina comum.
// Formato guardado: scrypt$N$r$p$sal$hash, com sal e hash em base64. Os parâmetros vão junto para poder subir o custo
// depois sem invalidar as senhas antigas.
const PARAMS = { N: 2 ** 15, r: 8, p: 1 };
const BYTES = 64;
const MEMORIA = 128 * 1024 * 1024;

const derivar = (senha: string, sal: Buffer, o: ScryptOptions) =>
  new Promise<Buffer>((ok, falha) => scrypt(senha.normalize("NFKC"), sal, BYTES, { ...o, maxmem: MEMORIA }, (e, h) => (e ? falha(e) : ok(h))));

const formatar = (sal: Buffer, hash: Buffer) => `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${sal.toString("base64")}$${hash.toString("base64")}`;

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16);
  return formatar(sal, await derivar(senha, sal, PARAMS));
}

/** Versão síncrona, só para criar os usuários mock na primeira abertura do banco. */
export function gerarHashSync(senha: string): string {
  const sal = randomBytes(16);
  return formatar(sal, scryptSync(senha.normalize("NFKC"), sal, BYTES, { ...PARAMS, maxmem: MEMORIA }));
}

export async function conferir(senha: string, guardado: string): Promise<boolean> {
  const [alg, n, r, p, sal, hash] = guardado.split("$");
  if (alg !== "scrypt" || !sal || !hash) return false;
  const esperado = Buffer.from(hash, "base64");
  const obtido = await derivar(senha, Buffer.from(sal, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return obtido.length === esperado.length && timingSafeEqual(obtido, esperado);
}

/** Hash válido de uma senha qualquer: login inexistente custa o mesmo tempo que senha errada. */
export const HASH_FICTICIO = gerarHashSync(randomBytes(12).toString("base64"));
