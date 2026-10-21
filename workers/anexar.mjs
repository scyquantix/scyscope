// Abre uma conexão em memória e anexa cada fonte, somente leitura, com o nome da API como esquema.
// Usado pelo worker de consulta, pela exportação e pela navegação. Roda antes do autorizador:
// depois dele, ATTACH e DETACH ficam proibidos para quem consulta.

import { DatabaseSync } from "node:sqlite";

export function conectar(fontes) {
  const db = new DatabaseSync(":memory:");
  for (const { id, arquivo } of fontes) {
    if (!/^[a-z_]+$/.test(id)) throw new Error(`Nome de esquema inválido: ${id}`);
    const uri = `file:${encodeURI(arquivo).replaceAll("?", "%3F").replaceAll("#", "%23")}?mode=ro`;
    db.exec(`ATTACH DATABASE '${uri.replaceAll("'", "''")}' AS ${id}`);
  }
  return db;
}
