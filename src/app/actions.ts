"use server";

import { executar, type Resultado } from "@/lib/executar";
import { excluirSalva, listarHistorico, listarSalvas, registrar, salvar, type ItemHistorico, type Salva } from "@/lib/estado";
import { exigirUsuario } from "@/lib/sessao";

// As ações devolvem as listas atualizadas: a bancada troca o estado local sem recarregar a página
// (um revalidatePath aqui rodaria de novo a consulta inicial do servidor a cada execução).
// Ações são endpoints POST acessíveis diretamente: cada uma confere a sessão, sem contar com o proxy.

export async function executarConsulta(sql: string): Promise<{ resultado: Resultado; historico: ItemHistorico[] }> {
  const u = await exigirUsuario();
  const resultado = await executar(sql);
  registrar(u.id, sql.trim(), resultado.ms, resultado.ok ? resultado.linhas.length : null, resultado.ok ? null : resultado.erro);
  return { resultado, historico: listarHistorico(u.id) };
}

export async function salvarConsulta(nome: string, sql: string, id?: number): Promise<{ id: number; salvas: Salva[] } | { erro: string }> {
  const u = await exigirUsuario();
  const n = nome.trim();
  if (!n) return { erro: "Dê um nome à consulta." };
  if (!sql.trim()) return { erro: "A consulta está vazia." };
  const novoId = salvar(u.id, n.slice(0, 120), sql, id);
  return { id: novoId, salvas: listarSalvas(u.id) };
}

export async function excluirConsulta(id: number): Promise<Salva[]> {
  const u = await exigirUsuario();
  excluirSalva(u.id, id);
  return listarSalvas(u.id);
}
