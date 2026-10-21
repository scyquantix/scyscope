"use client";

/** Formulário GET que se reenvia ao trocar qualquer seletor; o botão continua lá para quem navega sem JavaScript. */
export function FormAuto({ children, action, className }: { children: React.ReactNode; action: string; className?: string }) {
  return (
    <form action={action} className={className} onChange={(e) => {
      const alvo = e.target as HTMLElement;
      if (alvo.tagName === "SELECT") e.currentTarget.requestSubmit();
    }}>
      {children}
    </form>
  );
}
