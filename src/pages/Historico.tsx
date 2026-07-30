/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { History, RefreshCw, AlertTriangle, RotateCcw } from "lucide-react";
import { LogEdicao, PerfilUsuario } from "../types";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { reverterLog, TABELA_POR_ENTIDADE } from "../utils/logEdicoes";
import { toast } from "sonner";
import FilterBar from "../components/ui/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import { formatDate, formatTime } from "../utils/date";

interface HistoricoProps {
  activeRole: PerfilUsuario;
  currentUserEmail: string;
}

// Campos simples (string/number/boolean) renderizam como "campo: valor" direto.
// Campos que são objeto/array (ex: ficha_levantamento, com várias seções
// aninhadas) ficam recolhidos por padrão — só um resumo com a contagem — e só
// mostram o JSON completo se o usuário clicar, pra não poluir a tabela.
interface CampoValorProps {
  campo: string;
  valor: unknown;
}

function CampoValor({ campo, valor }: CampoValorProps) {
  const [aberto, setAberto] = useState(false);

  if (valor === null || valor === undefined) {
    return (
      <p className="text-[10px] leading-snug">
        <span className="text-slate-400">{campo}: </span>
        <span className="text-slate-300">—</span>
      </p>
    );
  }

  if (typeof valor !== "object") {
    return (
      <p className="text-[10px] leading-snug">
        <span className="text-slate-400">{campo}: </span>
        <span className="font-semibold text-slate-700 break-words">{String(valor)}</span>
      </p>
    );
  }

  const qtd = Array.isArray(valor) ? valor.length : Object.keys(valor).length;

  return (
    <div className="text-[10px] leading-snug">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="text-brand-600 font-semibold hover:underline cursor-pointer"
      >
        {campo} ({qtd} {Array.isArray(valor) ? "itens" : "campos"}) {aberto ? "▲" : "▼"}
      </button>
      {aberto && (
        <pre className="mt-1 max-h-48 overflow-auto bg-slate-50 border border-slate-100 rounded-lg p-2 text-[9px] font-mono whitespace-pre-wrap break-words">
          {JSON.stringify(valor, null, 2)}
        </pre>
      )}
    </div>
  );
}

function ValorResumo({ valor }: { valor: Record<string, unknown> | null }) {
  if (!valor) return <span className="text-slate-300">—</span>;
  const entradas = Object.entries(valor);
  if (entradas.length === 0) return <span className="text-slate-300">—</span>;
  return (
    <div className="space-y-1 max-w-[240px]">
      {entradas.map(([campo, v]) => (
        <React.Fragment key={campo}>
          <CampoValor campo={campo} valor={v} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Historico({ activeRole, currentUserEmail }: HistoricoProps) {
  const [logs, setLogs] = useState<LogEdicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterEntidade, setFilterEntidade] = useState("");
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<number | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("log_edicoes")
      .select("*")
      .order("criado_em", { ascending: false })
      .limit(300);

    setLoading(false);

    if (fetchError) {
      setError(fetchError.message);
      toast.error("Erro ao carregar histórico.", { description: fetchError.message });
      return;
    }

    setLogs(data || []);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const entidades = useMemo(() => Array.from(new Set(logs.map((l) => l.entidade))).sort(), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterEntidade && log.entidade !== filterEntidade) return false;
      if (search) {
        const term = search.toLowerCase();
        const matches = log.usuario?.toLowerCase().includes(term) || log.acao?.toLowerCase().includes(term) || String(log.entidade_id).includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, search, filterEntidade]);

  const handleReverter = async (log: LogEdicao) => {
    setRevertingId(log.id);
    try {
      await reverterLog(log, currentUserEmail);
      toast.success("Alteração revertida com sucesso.");
      setConfirmandoId(null);
      fetchLogs();
    } catch (err: any) {
      toast.error("Erro ao reverter alteração.", { description: err.message });
    } finally {
      setRevertingId(null);
    }
  };

  const filterFields = [
    {
      key: "entidade",
      label: "Entidade",
      value: filterEntidade,
      options: entidades.map((e) => ({ value: e, label: e })),
      onChange: setFilterEntidade
    }
  ];

  return (
    <div id="historico-page" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <History className="w-6 h-6 text-brand-500" />
          <span>Histórico de Alterações</span>
        </h1>
        <p className="text-sm text-slate-500">
          Toda edição relevante feita no sistema fica registrada aqui: quem fez, o que mudou e quando.
        </p>
      </div>

      <FilterBar
        id="historico-filters"
        searchPlaceholder="Buscar por usuário, ação ou ID..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        onClearFilters={() => {
          setSearch("");
          setFilterEntidade("");
        }}
        hasActiveFilters={search !== "" || filterEntidade !== ""}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="h-16 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto shadow-soft">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Falha ao carregar histórico</h3>
          <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
          <button
            onClick={fetchLogs}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          id="historico-empty"
          title="Nenhum registro encontrado"
          description="Ainda não há alterações registradas para os filtros aplicados."
        />
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-soft">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-[9px] uppercase font-bold text-slate-400">
                <th className="py-2.5 px-3">Data</th>
                <th className="py-2.5 px-3">Usuário</th>
                <th className="py-2.5 px-3">Ação</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Antes</th>
                <th className="py-2.5 px-3">Depois</th>
                {activeRole === PerfilUsuario.ADMIN && <th className="py-2.5 px-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs align-top">
              {filteredLogs.map((log) => {
                // "excluiu_definitivamente" é um DELETE real — não existe update pra reverter
                // (a linha não existe mais na tabela), então nunca mostra o botão pra essa ação.
                const podeReverter =
                  Boolean(TABELA_POR_ENTIDADE[log.entidade]) &&
                  Boolean(log.valor_antes) &&
                  log.acao !== "reverteu" &&
                  log.acao !== "excluiu_definitivamente";
                return (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {formatDate(log.criado_em)} <span className="text-slate-300">·</span> {formatTime(log.criado_em)}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-700 whitespace-nowrap">{log.usuario}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-slate-100 text-slate-600 border-slate-200">
                        {log.acao}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {log.entidade} <span className="text-slate-300 font-mono">#{log.entidade_id}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <ValorResumo valor={log.valor_antes} />
                    </td>
                    <td className="py-2.5 px-3">
                      <ValorResumo valor={log.valor_depois} />
                    </td>
                    {activeRole === PerfilUsuario.ADMIN && (
                      <td className="py-2.5 px-3 text-right">
                        {podeReverter ? (
                          confirmandoId === log.id ? (
                            <div className="flex flex-col items-end gap-1.5">
                              <span className="text-[10px] text-slate-500 max-w-[140px] text-right">
                                Restaurar o estado anterior?
                              </span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleReverter(log)}
                                  disabled={revertingId === log.id}
                                  className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-60"
                                >
                                  {revertingId === log.id ? "Revertendo..." : "Confirmar"}
                                </button>
                                <button
                                  onClick={() => setConfirmandoId(null)}
                                  disabled={revertingId === log.id}
                                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmandoId(log.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-colors cursor-pointer"
                              title="Reverter"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reverter
                            </button>
                          )
                        ) : (
                          <span className="text-slate-300 text-[10px]">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
