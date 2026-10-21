import type { DatabaseSync } from "node:sqlite";
export function conectar(fontes: { id: string; arquivo: string }[]): DatabaseSync;
