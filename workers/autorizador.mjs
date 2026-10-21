// Regra de só-leitura aplicada pelo próprio SQLite (sqlite3_set_authorizer).
// Usada pelo worker de consulta e pela exportação CSV.

import { constants as c } from "node:sqlite";

// PRAGMAs de leitura do esquema, liberados para quem quiser inspecionar tabelas
const PRAGMAS_LIVRES = new Set(["table_info", "table_xinfo", "index_list", "index_info", "index_xinfo", "foreign_key_list"]);

export function autorizar(acao, arg1) {
  switch (acao) {
    case c.SQLITE_SELECT:
    case c.SQLITE_READ:
    case c.SQLITE_FUNCTION:
    case c.SQLITE_RECURSIVE:
      return c.SQLITE_OK;
    case c.SQLITE_PRAGMA:
      return PRAGMAS_LIVRES.has(String(arg1).toLowerCase()) ? c.SQLITE_OK : c.SQLITE_DENY;
    default:
      return c.SQLITE_DENY;
  }
}
