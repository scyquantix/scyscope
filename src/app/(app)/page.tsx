import { esquemas, fontesAusentes } from "@/lib/esquema";
import { executar } from "@/lib/executar";
import { listarHistorico, listarSalvas } from "@/lib/estado";
import { EXEMPLOS } from "@/lib/exemplos";
import { exigirUsuario } from "@/lib/sessao";
import { decodificar } from "@/lib/sql";
import { Bancada } from "@/components/bancada";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function Consulta({ searchParams }: Props) {
  const usuario = await exigirUsuario();
  const { q } = await searchParams;
  const sql = (q && decodificar(q)) || EXEMPLOS[0].sql;
  // Um link com ?q= abre com o resultado já calculado no servidor; sem ?q=, abre com o primeiro exemplo rodado
  const resultado = await executar(sql);
  return (
    <Bancada
      sqlInicial={sql}
      resultadoInicial={resultado}
      esquemas={esquemas()}
      ausentes={fontesAusentes().map(({ arquivo: _, ...f }) => f)}
      exemplos={EXEMPLOS}
      salvas={listarSalvas(usuario.id)}
      historico={listarHistorico(usuario.id)}
    />
  );
}
