import "server-only";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ARQUIVO_ESTADO } from "./config";
import { gerarHashSync } from "./senha";

/*
 * Banco gravável do ScyScope (data/explorer.db): usuários, sessões, registro de acessos, consultas salvas e histórico.
 * Não é anexado às consultas SQL de quem usa o app; só este módulo o abre.
 *
 * RLS emulado. O SQLite não tem row level security, então as regras ficam no próprio banco, como no Postgres:
 * - usuario_atual() devolve o usuário da operação em curso, definido por comoUsuario(). Fora dele, NULL.
 * - Leitura: as views minhas_salvas e meu_historico só mostram as linhas de usuario_atual().
 * - Escrita: gatilhos abortam INSERT, UPDATE e DELETE em linhas de outro usuário, e qualquer UPDATE ou DELETE em acessos.
 * - comoServico() é o equivalente ao service_role do Supabase (ignora as regras): só para login e para criar usuários.
 * O node:sqlite é síncrono, então nenhuma outra requisição roda entre definir o usuário e terminar a operação.
 * No deploy, isso vira RLS de verdade no Postgres, com auth.uid() no lugar de usuario_atual() (docs/acesso.md).
 */

let usuario: string | null = null;
let servico = false;

/** Usuários mock do MVP local. Os dois trocam a senha no primeiro acesso. */
const USUARIOS_MOCK = [
  { login: "leo", nome: "Leonardo Souza" },
  { login: "fabricio", nome: "Fabrício Toccoli Fenili" },
];
const SENHA_INICIAL_MOCK = "scyscope@2026";

// Gatilhos de escrita das tabelas com dono: a mesma regra para salvas, historico e sessoes
const regrasDono = (t: string) => `
  CREATE TRIGGER IF NOT EXISTS rls_${t}_insert BEFORE INSERT ON ${t}
    WHEN NOT rls_ignorada() AND NEW.usuario_id IS NOT usuario_atual()
    BEGIN SELECT RAISE(ABORT, 'rls: ${t} de outro usuário'); END;
  CREATE TRIGGER IF NOT EXISTS rls_${t}_update BEFORE UPDATE ON ${t}
    WHEN NOT rls_ignorada() AND (OLD.usuario_id IS NOT usuario_atual() OR NEW.usuario_id IS NOT OLD.usuario_id)
    BEGIN SELECT RAISE(ABORT, 'rls: ${t} de outro usuário'); END;
  CREATE TRIGGER IF NOT EXISTS rls_${t}_delete BEFORE DELETE ON ${t}
    WHEN NOT rls_ignorada() AND OLD.usuario_id IS NOT usuario_atual()
    BEGIN SELECT RAISE(ABORT, 'rls: ${t} de outro usuário'); END;
`;

let conexao: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (conexao) return conexao;
  mkdirSync(dirname(ARQUIVO_ESTADO), { recursive: true });
  const d = new DatabaseSync(ARQUIVO_ESTADO);
  d.function("usuario_atual", { deterministic: false }, () => usuario);
  d.function("rls_ignorada", { deterministic: false }, () => (servico ? 1 : 0));
  d.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    -- id em UUID, o mesmo tipo do auth.users.id do Supabase: é a chave que liga o ScyScope ao ScyHome
    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY,
      login TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nome TEXT NOT NULL,
      senha_hash TEXT NOT NULL,
      trocar_senha INTEGER NOT NULL DEFAULT 1,
      ativo INTEGER NOT NULL DEFAULT 1,
      criado TEXT NOT NULL,
      senha_alterada TEXT,
      ultimo_acesso TEXT
    );
    -- id é o SHA-256 do token do cookie: quem lê o banco não consegue se passar pela sessão
    CREATE TABLE IF NOT EXISTS sessoes (
      id TEXT PRIMARY KEY,
      usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      criada TEXT NOT NULL,
      expira TEXT NOT NULL,
      encerrada TEXT,
      agente TEXT
    );
    CREATE INDEX IF NOT EXISTS sessoes_usuario ON sessoes(usuario_id);
    -- Registro de login e logoff, só de acréscimo
    CREATE TABLE IF NOT EXISTS acessos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
      login TEXT NOT NULL,
      evento TEXT NOT NULL CHECK (evento IN ('entrada', 'saida', 'falha', 'bloqueio', 'troca_senha')),
      quando TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS acessos_login ON acessos(login COLLATE NOCASE, quando);

    CREATE TABLE IF NOT EXISTS salvas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      sql TEXT NOT NULL,
      criada TEXT NOT NULL,
      atualizada TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historico (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sql TEXT NOT NULL,
      quando TEXT NOT NULL,
      ms REAL,
      linhas INTEGER,
      erro TEXT
    );
  `);

  // Bancos de antes do login: salvas e historico ganham o dono
  for (const t of ["salvas", "historico"]) {
    const colunas = d.prepare(`SELECT name FROM pragma_table_info('${t}')`).all().map((c) => c.name);
    if (!colunas.includes("usuario_id")) d.exec(`ALTER TABLE ${t} ADD COLUMN usuario_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE`);
    d.exec(`CREATE INDEX IF NOT EXISTS ${t}_usuario ON ${t}(usuario_id)`);
  }

  d.exec(`
    CREATE VIEW IF NOT EXISTS minhas_salvas AS SELECT * FROM salvas WHERE usuario_id = usuario_atual();
    CREATE VIEW IF NOT EXISTS meu_historico AS SELECT * FROM historico WHERE usuario_id = usuario_atual();
    ${regrasDono("salvas")}
    ${regrasDono("historico")}
    ${regrasDono("sessoes")}
    CREATE TRIGGER IF NOT EXISTS rls_usuarios_insert BEFORE INSERT ON usuarios
      WHEN NOT rls_ignorada() BEGIN SELECT RAISE(ABORT, 'rls: só o serviço cria usuários'); END;
    CREATE TRIGGER IF NOT EXISTS rls_usuarios_update BEFORE UPDATE ON usuarios
      WHEN NOT rls_ignorada() AND (OLD.id IS NOT usuario_atual() OR NEW.id IS NOT OLD.id OR NEW.login IS NOT OLD.login OR NEW.ativo IS NOT OLD.ativo)
      BEGIN SELECT RAISE(ABORT, 'rls: usuário só altera a própria senha e o próprio acesso'); END;
    CREATE TRIGGER IF NOT EXISTS rls_usuarios_delete BEFORE DELETE ON usuarios
      WHEN NOT rls_ignorada() BEGIN SELECT RAISE(ABORT, 'rls: só o serviço remove usuários'); END;
    CREATE TRIGGER IF NOT EXISTS rls_acessos_update BEFORE UPDATE ON acessos
      WHEN NOT rls_ignorada() BEGIN SELECT RAISE(ABORT, 'rls: o registro de acessos não se altera'); END;
    CREATE TRIGGER IF NOT EXISTS rls_acessos_delete BEFORE DELETE ON acessos
      WHEN NOT rls_ignorada() BEGIN SELECT RAISE(ABORT, 'rls: o registro de acessos não se apaga'); END;
  `);

  conexao = d;
  comoServico(semearMock);
  return d;
}

/** Cria os usuários mock se ainda não houver nenhum e passa a eles o que foi salvo antes do login (ao leo). */
function semearMock() {
  const d = db();
  if ((d.prepare("SELECT count(*) AS n FROM usuarios").get() as { n: number }).n > 0) return;
  const agora = new Date().toISOString();
  const inserir = d.prepare("INSERT INTO usuarios (id, login, nome, senha_hash, trocar_senha, criado) VALUES (?, ?, ?, ?, 1, ?)");
  for (const u of USUARIOS_MOCK) inserir.run(randomUUID(), u.login, u.nome, gerarHashSync(SENHA_INICIAL_MOCK), agora);
  const leo = d.prepare("SELECT id FROM usuarios WHERE login = 'leo'").get() as { id: string };
  d.prepare("UPDATE salvas SET usuario_id = ? WHERE usuario_id IS NULL").run(leo.id);
  d.prepare("UPDATE historico SET usuario_id = ? WHERE usuario_id IS NULL").run(leo.id);
}

/** Roda fn com usuario_atual() = id. fn tem de ser síncrona: o usuário volta a NULL assim que ela termina. */
export function comoUsuario<T>(id: string, fn: () => T): T {
  db();
  const antes = usuario;
  usuario = id;
  try {
    const r = fn();
    if (r instanceof Promise) throw new Error("comoUsuario recebe só funções síncronas");
    return r;
  } finally {
    usuario = antes;
  }
}

/** Ignora as regras de RLS, como o service_role do Supabase. Só para o login e a criação de usuários. */
export function comoServico<T>(fn: () => T): T {
  const antes = servico;
  servico = true;
  try {
    const r = fn();
    if (r instanceof Promise) throw new Error("comoServico recebe só funções síncronas");
    return r;
  } finally {
    servico = antes;
  }
}

// O node:sqlite devolve objetos sem protótipo, que o React não envia ao cliente: copiar para objetos comuns
export const simples = <T,>(linhas: unknown[]) => linhas.map((l) => ({ ...(l as object) })) as T[];
