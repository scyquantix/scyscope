import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { FONTES, type IdFonte } from "./fontes";

// turbopackIgnore: os bancos ficam fora do código e não devem ser empacotados com o servidor
const RAIZ = /*turbopackIgnore: true*/ process.cwd();

/** Um SQLite por API, em data/fontes (npm run sync). O siconfi.db vem no repositório; os demais são gerados. */
export const ARQUIVOS: Record<IdFonte, string> = {
  siconfi: join(/*turbopackIgnore: true*/ RAIZ, "data", "fontes", "siconfi.db"),
  tce: join(/*turbopackIgnore: true*/ RAIZ, "data", "fontes", "tce.db"),
  ibge: join(/*turbopackIgnore: true*/ RAIZ, "data", "fontes", "ibge.db"),
  bacen: join(/*turbopackIgnore: true*/ RAIZ, "data", "fontes", "bacen.db"),
};

/** Fontes com arquivo presente, na ordem do catálogo. */
export function fontesDisponiveis(): { id: IdFonte; arquivo: string }[] {
  return FONTES.filter((f) => existsSync(ARQUIVOS[f.id])).map((f) => ({ id: f.id, arquivo: ARQUIVOS[f.id] }));
}

/** Estado do próprio ScyScope (consultas salvas e histórico), num arquivo separado e gravável. O nome explorer.db vem da época do BRAexplorer e ficou para não perder o que já está salvo. */
export const ARQUIVO_ESTADO = join(/*turbopackIgnore: true*/ RAIZ, "data", "explorer.db");

export const LIMITE_LINHAS = 5000;
export const LIMITE_EXPORTACAO = 200_000;
export const TEMPO_LIMITE_MS = 15_000;
