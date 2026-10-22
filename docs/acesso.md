# Login e controle de acesso do ScyScope

Status: **implementado no MVP local**, 21/10/2026.

> ⚠️ **Rever antes de qualquer deploy.** Este nível de segurança basta para o MVP rodando em `127.0.0.1`. Ele **não** foi pensado para ficar exposto na internet. A lista do que muda está na [seção 6](#6-revisar-no-deploy).

## 1. O que existe

- Login com **login e senha**. Sem a sessão, todas as páginas mandam para `/entrar` e a API responde 401.
- **Primeiro acesso:** depois da senha inicial, o sistema exige registrar uma senha nova (`/nova-senha`). Até isso acontecer, nenhuma página do app abre.
- **Logoff:** o botão no pé do trilho de navegação encerra a sessão no banco e apaga o cookie.
- **Dados por usuário:** as consultas salvas e o histórico passam a ter dono. Cada pessoa só vê e altera os próprios.
- **Registro de acessos:** cada entrada, saída, falha, bloqueio e troca de senha fica na tabela `acessos`, que só aceita acréscimos.
- **Bloqueio por tentativas:** depois de 5 falhas seguidas em 15 minutos, o login fica bloqueado até a janela passar.

### Acessos mock

| Login | Senha inicial | Nome |
| --- | --- | --- |
| `leo` | `scyscope@2026` | Leonardo Souza |
| `fabricio` | `scyscope@2026` | Fabrício Toccoli Fenili |

Os dois são criados na primeira vez que o app abre o `data/explorer.db` e precisam trocar a senha no primeiro login. O histórico salvo antes do login passa para o `leo`.

Para voltar ao estado inicial, apague as três tabelas de acesso ou o arquivo inteiro: `rm data/explorer.db*`. Isso também apaga as consultas salvas e o histórico.

## 2. Tabelas (`data/explorer.db`)

O arquivo não vai para o git (`data/**/*.db` no `.gitignore`) e **não** é anexado às consultas SQL de quem usa o app. Só `src/lib/banco.ts` o abre.

| Tabela | Conteúdo |
| --- | --- |
| `usuarios` | `id` (UUID v4), `login` (único, sem distinção de maiúsculas), `nome`, `senha_hash`, `trocar_senha`, `ativo`, `criado`, `senha_alterada`, `ultimo_acesso` |
| `sessoes` | `id` (SHA-256 do token do cookie), `usuario_id`, `criada`, `expira`, `encerrada` (logoff), `agente` (user-agent) |
| `acessos` | `usuario_id`, `login`, `evento` (`entrada`, `saida`, `falha`, `bloqueio`, `troca_senha`), `quando` |
| `salvas`, `historico` | As de antes, agora com `usuario_id` |

**`usuarios.id` é a chave para os próximos passos.** É um UUID, o mesmo tipo do `auth.users.id` do Supabase que o ScyHome deve usar. Tudo o que for por usuário daqui para a frente referencia essa coluna, nunca o login.

### Senhas

- Guardadas com **scrypt** do `node:crypto` (N = 2^15, r = 8, p = 1, sal aleatório de 16 bytes). O formato é `scrypt$N$r$p$sal$hash`. Os parâmetros ficam junto do hash, então o custo pode subir sem invalidar as senhas antigas.
- Comparação em tempo constante. Login inexistente também passa pelo scrypt, para o tempo de resposta não revelar quem tem conta.
- Regras da senha nova: pelo menos 10 caracteres, com letras e números, diferente da inicial e sem conter o login.

### Sessões

- O cookie `scyscope_sessao` leva um token aleatório de 32 bytes, com `httpOnly` e `sameSite=lax`. O banco guarda só o SHA-256 do token: quem lê o arquivo não consegue se passar pela sessão.
- A validade é de 12 horas, contadas da abertura. Trocar a senha encerra as outras sessões do usuário.

## 3. RLS no SQLite

O SQLite não tem row level security. Para as regras ficarem **no banco** e não só no código, como serão no Postgres, `src/lib/banco.ts` emula o RLS assim:

- `usuario_atual()`: função registrada na conexão que devolve o usuário da operação em curso. Ele é definido por `comoUsuario(id, fn)`; fora disso, a função devolve `NULL`. O `node:sqlite` é síncrono, então nenhuma outra requisição roda no meio.
- **Leitura:** as views `minhas_salvas` e `meu_historico` filtram por `usuario_atual()`. O código do app lê por elas.
- **Escrita:** gatilhos `BEFORE INSERT/UPDATE/DELETE` abortam com `rls: ...` qualquer escrita em linha de outro usuário, em `salvas`, `historico` e `sessoes`. Em `usuarios`, cada pessoa só altera a própria linha e não muda `id`, `login` nem `ativo`; criar e remover usuários é só para o serviço. Em `acessos`, `UPDATE` e `DELETE` são sempre negados.
- `comoServico(fn)`: ignora as regras, como o `service_role` do Supabase. É usado só no login (achar o usuário pelo login e a sessão pelo token) e na criação dos mocks.

Limitação conhecida: as views controlam a leitura, mas as tabelas-base continuam legíveis para quem tem a conexão. No SQLite não há como negar isso sem um autorizador. Por isso o arquivo nunca é anexado às consultas dos usuários.

## 4. Onde a sessão é conferida

| Camada | Arquivo | O que faz |
| --- | --- | --- |
| Proxy | `src/proxy.ts` | Checagem otimista: sem cookie, redireciona para `/entrar?de=...` (ou 401 em `/api/`) |
| Páginas | `src/app/(app)/layout.tsx` e cada `page.tsx` | `exigirUsuario()`: sessão aberta, não expirada, usuário ativo e senha já trocada |
| Ações | `src/app/actions.ts` | `exigirUsuario()` em cada ação, porque as ações são endpoints POST acessíveis diretamente |
| Exportação | `src/app/api/exportar/route.ts` | 401 sem sessão válida ou com a troca de senha pendente |

O destino `?de=` só aceita caminhos internos, para evitar redirecionamento aberto.

## 5. Integração futura com o ScyHome

O ScyHome (`scyquantix/scyhome`) já prevê `packages/` para "auth" compartilhado. O caminho previsto:

1. O ScyHome passa a ser o **provedor de identidade** (Supabase Auth). O login sai do ScyScope, e as telas de `/entrar` e `/nova-senha` migram para lá.
2. O ScyScope deixa de ter `usuarios.senha_hash` e `sessoes`. Ele lê a sessão do Supabase (cookie no domínio `.scyquantix.com`) e usa `auth.uid()`.
3. `salvas` e `historico` vão para o Postgres com `usuario_id uuid references auth.users(id)`, e o RLS de verdade substitui os gatilhos:

   ```sql
   alter table app.salvas enable row level security;
   create policy dono on app.salvas for all
     using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
   ```

4. **Migração dos usuários:** os ids são UUID, então podem ser preservados ao criar as contas no Supabase Auth. Os hashes scrypt **não** são importáveis (o Supabase aceita bcrypt e argon2). Na migração, cada pessoa redefine a senha. Isso é aceitável enquanto só houver os mocks.

## 6. Revisar no deploy

Itens obrigatórios antes de expor o app fora de `127.0.0.1`:

- [ ] **Trocar o login local pelo do ScyHome/Supabase Auth** (seção 5) ou, no mínimo, revisar todo este documento.
- [ ] **Remover os usuários mock** e a senha inicial do código (`USUARIOS_MOCK` e `SENHA_INICIAL_MOCK` em `src/lib/banco.ts`). Contas reais nascem por convite, sem senha conhecida.
- [ ] **Cookie `secure: true`** (só HTTPS) em `src/lib/sessao.ts`. Avaliar o prefixo `__Host-`, ou `Domain=.scyquantix.com` se a sessão for compartilhada com o ScyHome.
- [ ] **RLS de verdade no Postgres** no lugar dos gatilhos, com o papel do app sem `BYPASSRLS`.
- [ ] **Limite de tentativas por IP e global**, não só por login. Hoje dá para bloquear a conta de alguém de propósito, com 5 tentativas erradas.
- [ ] **CSRF:** as ações do Next conferem a origem. Confirmar `serverActions.allowedOrigins` se houver domínio próprio ou proxy na frente.
- [ ] **Validade da sessão:** somar expiração por inatividade, rotação do token e limpeza das sessões vencidas.
- [ ] **Recuperação de senha** por e-mail e, para contas administrativas, 2FA.
- [ ] **Política de senha:** checar contra listas de senhas vazadas (por exemplo, a API k-anônima do Have I Been Pwned).
- [ ] **LGPD:** a tabela `acessos` guarda login e horário; `sessoes` guarda o user-agent. Definir retenção e informar na política de privacidade.
- [ ] **Cabeçalhos de segurança** (CSP, HSTS, `frame-ancestors`) na Vercel.
