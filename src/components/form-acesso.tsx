"use client";

import { useActionState, useEffect, useState, type InputHTMLAttributes } from "react";
import { conferirSenhaNova, entrar, registrarSenha, type EstadoForm } from "@/app/acesso";
import { forcaSenha, motivoRecusa, NIVEIS_FORCA, SENHA_MAX, SENHA_MIN } from "@/lib/regras-senha";

const SETA = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

// Olho aberto e riscado, no traço dos ícones do site (lucide)
const OLHO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" /><circle cx="12" cy="12" r="3" /></svg>
);
const OLHO_RISCADO = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.73 5.08a10.74 10.74 0 0 1 11.2 6.57 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-1.44 2.49" /><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5a10.75 10.75 0 0 1-15.42-5.15 1 1 0 0 1 0-.7 10.75 10.75 0 0 1 4.45-5.14" /><path d="m2 2 20 20" /></svg>
);

function Erro({ estado }: { estado: EstadoForm }) {
  return <p className="acesso-erro" role="alert" hidden={!estado.erro}>{estado.erro}</p>;
}

/** Campo de senha com o botão de olho para mostrar o que foi digitado. */
function CampoSenha(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  const [visivel, setVisivel] = useState(false);
  return (
    <span className="campo-senha">
      <input {...props} type={visivel ? "text" : "password"} className="campo-acesso" autoCapitalize="none" spellCheck={false} />
      <button type="button" className="olho" onClick={() => setVisivel((v) => !v)} aria-pressed={visivel} aria-label={visivel ? "Ocultar senha" : "Mostrar senha"} title={visivel ? "Ocultar senha" : "Mostrar senha"}>
        {visivel ? OLHO_RISCADO : OLHO}
      </button>
    </span>
  );
}

function Medidor({ senha, login }: { senha: string; login: string }) {
  // "Diferente da senha atual" depende do hash: o servidor confere 400 ms depois da última tecla
  const [igual, setIgual] = useState<{ senha: string; motivo: string | null } | null>(null);
  const local = senha ? motivoRecusa(senha, login) : null;
  useEffect(() => {
    if (!senha || local) return;
    let valida = true;
    const t = setTimeout(() => conferirSenhaNova(senha).then((motivo) => valida && setIgual({ senha, motivo })), 400);
    return () => { valida = false; clearTimeout(t); };
  }, [senha, local]);
  const recusa = local ?? (igual?.senha === senha ? igual.motivo : null);
  const n = recusa ? 0 : forcaSenha(senha, login);
  return (
    <div className="medidor" data-nivel={senha ? n : undefined} aria-live="polite">
      <div className="medidor-barras" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} data-ativa={i <= n} />)}</div>
      <span className="medidor-rotulo">
        {senha ? <>Força da senha: <b>{NIVEIS_FORCA[n]}</b>{recusa && <> · {recusa}</>}</> : "Força da senha"}
      </span>
    </div>
  );
}

export function FormEntrar({ de }: { de: string }) {
  const [estado, acao, pendente] = useActionState(entrar, { erro: null });
  return (
    <form action={acao} className="acesso-form">
      <input type="hidden" name="de" value={de} />
      <label className="rotulo">
        Login
        <input className="campo-acesso" name="login" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={estado.login} autoFocus />
      </label>
      <label className="rotulo">
        Senha
        <CampoSenha name="senha" autoComplete="current-password" required />
      </label>
      <Erro estado={estado} />
      <button type="submit" className="botao-acesso" disabled={pendente}>
        {pendente ? "Conferindo…" : "Entrar"} {SETA}
      </button>
    </form>
  );
}

export function FormNovaSenha({ login }: { login: string }) {
  const [estado, acao, pendente] = useActionState(registrarSenha, { erro: null });
  const [nova, setNova] = useState("");
  return (
    <form action={acao} className="acesso-form">
      {/* Para o gerenciador de senhas associar a senha nova ao login certo */}
      <input type="text" name="usuario" value={login} autoComplete="username" readOnly hidden />
      <label className="rotulo">
        Senha nova
        <CampoSenha name="nova" autoComplete="new-password" minLength={SENHA_MIN} maxLength={SENHA_MAX} required autoFocus value={nova} onChange={(e) => setNova(e.target.value)} />
      </label>
      <Medidor senha={nova} login={login} />
      <label className="rotulo">
        Confirme a senha nova
        <CampoSenha name="confirmacao" autoComplete="new-password" minLength={SENHA_MIN} maxLength={SENHA_MAX} required />
      </label>
      <ul className="acesso-regras">
        <li>Pelo menos 10 caracteres, com letras e números.</li>
        <li>Diferente da senha inicial e sem o seu login.</li>
      </ul>
      <Erro estado={estado} />
      <button type="submit" className="botao-acesso" disabled={pendente}>
        {pendente ? "Registrando…" : "Registrar senha"} {SETA}
      </button>
    </form>
  );
}
