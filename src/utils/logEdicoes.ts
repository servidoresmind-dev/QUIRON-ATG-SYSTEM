// Log de edições (Ajuste #6 — AJUSTES_ALISSON.md).
//
// Registra, para cada escrita real que o front faz diretamente numa tabela,
// quem fez, o que mudou (antes/depois) e permite reverter depois. `valor_antes`
// e `valor_depois` guardam só os campos que de fato mudaram (não a linha
// inteira), então reverter é simplesmente reaplicar `valor_antes` como update
// parcial na mesma tabela.
//
// Só cobre pontos de escrita que hoje são reais (PATCH direto na tabela).
// Ações que ainda dependem de RPCs inexistentes no backend (validar_cadastro,
// salvar_preditiva, criar_gerador) não geram log aqui — quando essas RPCs
// existirem de verdade, o ideal é que elas mesmas gravem o log no banco.

import { supabase } from "./supabase";
import { LogEdicao } from "../types";

// Mapa entidade → tabela real, usado tanto para registrar quanto para reverter.
export const TABELA_POR_ENTIDADE: Record<string, string> = {
  cliente: "omie_clientes",
  gerador: "geradores_atg",
  ficha: "geradores_atg",
  oxicatalisador: "oxicatalisador_atg",
  // Tabela legada da página antiga "Geradores" — separada de geradores_atg.
  gerador_legado: "geradores"
};

export async function registrarLog(
  entidade: string,
  entidadeId: number,
  acao: string,
  usuario: string,
  valorAntes: Record<string, unknown> | null,
  valorDepois: Record<string, unknown> | null
): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase.from("log_edicoes").insert({
    entidade,
    entidade_id: entidadeId,
    acao,
    usuario,
    valor_antes: valorAntes,
    valor_depois: valorDepois
  });

  if (error) {
    // Não bloqueia a ação principal por causa do log — só avisa no console.
    console.warn("Não foi possível registrar o log de edição.", error.message);
  }
}

export async function reverterLog(log: LogEdicao, usuarioReversao: string): Promise<void> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const tabela = TABELA_POR_ENTIDADE[log.entidade];
  if (!tabela) {
    throw new Error(`Reversão não suportada para a entidade "${log.entidade}".`);
  }
  if (!log.valor_antes) {
    throw new Error("Este registro não tem um valor anterior salvo para reverter.");
  }

  const { error } = await supabase.from(tabela).update(log.valor_antes).eq("id", log.entidade_id);
  if (error) throw error;

  await registrarLog(log.entidade, log.entidade_id, "reverteu", usuarioReversao, log.valor_depois, log.valor_antes);
}
