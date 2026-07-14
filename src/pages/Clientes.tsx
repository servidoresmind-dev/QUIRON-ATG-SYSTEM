/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Users,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Circle,
  Zap,
  Plus,
  Eye
} from "lucide-react";
import { ClienteCard, GeradorAtg, EstadoClienteCard } from "../types";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { toast } from "sonner";
import FilterBar from "../components/ui/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import GeradorModal from "../components/Clientes/GeradorModal";
import AdicionarGeradorWizard from "../components/Clientes/AdicionarGeradorWizard";
import { validarCadastro } from "../utils/atgBackend";

const ESTADO_INFO: Record<EstadoClienteCard, { label: string; dot: string; badge: string }> = {
  SEM_ICLASS: { label: "Sem iClass", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 border-rose-100" },
  SEM_GERADOR: { label: "Sem Gerador", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  SEM_FICHA: { label: "Sem Ficha", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 border-amber-100" },
  COMPLETO: { label: "Completo", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  VALIDADO: { label: "Validado", dot: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" }
};

export default function Clientes() {
  const [clientes, setClientes] = useState<ClienteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("desconhecido");

  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [validating, setValidating] = useState(false);

  const [geradoresByCliente, setGeradoresByCliente] = useState<Record<number, GeradorAtg[]>>({});
  const [loadingGeradores, setLoadingGeradores] = useState(false);
  const [showGeradoresFor, setShowGeradoresFor] = useState<number | null>(null);

  const [selectedGerador, setSelectedGerador] = useState<GeradorAtg | null>(null);
  const [addGeradorForCliente, setAddGeradorForCliente] = useState<ClienteCard | null>(null);

  const fetchClientes = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("vw_cliente_card")
      .select("*")
      .order("razao_social", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      toast.error("Erro ao carregar clientes.", { description: fetchError.message });
    } else {
      setClientes(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchClientes();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user?.email) setCurrentUserEmail(data.user.email);
    });
  }, []);

  const handleClearFilters = () => {
    setSearch("");
    setFilterEstado("");
  };

  const hasActiveFilters = search !== "" || filterEstado !== "";

  const filteredList = useMemo(() => {
    return clientes.filter((c) => {
      if (search) {
        const term = search.toLowerCase();
        const matches =
          c.razao_social?.toLowerCase().includes(term) ||
          c.nome_fantasia?.toLowerCase().includes(term) ||
          c.cnpj_raw?.toLowerCase().includes(term) ||
          c.cnpj_limpo?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (filterEstado && c.estado !== filterEstado) return false;
      return true;
    });
  }, [clientes, search, filterEstado]);

  const filterFields = [
    {
      key: "estado",
      label: "Estado",
      value: filterEstado,
      options: (Object.keys(ESTADO_INFO) as EstadoClienteCard[]).map((k) => ({
        value: k,
        label: ESTADO_INFO[k].label
      })),
      onChange: setFilterEstado
    }
  ];

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
    setShowGeradoresFor(null);
  };

  const fetchGeradores = async (clienteId: number) => {
    if (!supabase) return;
    setLoadingGeradores(true);

    const { data, error: fetchError } = await supabase
      .from("geradores_atg")
      .select("*")
      .eq("omie_cliente_id", clienteId)
      .order("descricao", { ascending: true });

    setLoadingGeradores(false);

    if (fetchError) {
      toast.error("Erro ao carregar geradores.", { description: fetchError.message });
      return;
    }

    setGeradoresByCliente((prev) => ({ ...prev, [clienteId]: data || [] }));
  };

  const handleToggleGeradores = (clienteId: number) => {
    if (showGeradoresFor === clienteId) {
      setShowGeradoresFor(null);
      return;
    }
    setShowGeradoresFor(clienteId);
    if (!geradoresByCliente[clienteId]) {
      fetchGeradores(clienteId);
    }
  };

  const handleValidarCliente = async (cliente: ClienteCard) => {
    setValidating(true);
    try {
      const result = await validarCadastro("cliente", cliente.id, currentUserEmail, !cliente.cliente_validado);
      if (!result.ok) throw new Error("A validação não foi confirmada pelo backend.");

      setClientes((prev) =>
        prev.map((c) =>
          c.id === cliente.id
            ? {
                ...c,
                cliente_validado: !cliente.cliente_validado,
                estado: !cliente.cliente_validado ? "VALIDADO" : c.estado === "VALIDADO" ? "COMPLETO" : c.estado
              }
            : c
        )
      );
      toast.success(
        !cliente.cliente_validado
          ? `${cliente.razao_social} marcado como validado.`
          : `Validação de ${cliente.razao_social} desfeita.`
      );
    } catch (err: any) {
      toast.error("Erro ao validar cliente.", { description: err.message });
    } finally {
      setValidating(false);
    }
  };

  const handleGeradorUpdated = (updated: GeradorAtg) => {
    setGeradoresByCliente((prev) => {
      const list = prev[updated.omie_cliente_id] || [];
      return {
        ...prev,
        [updated.omie_cliente_id]: list.map((g) => (g.id === updated.id ? updated : g))
      };
    });
    // Refresh the card summary counts/estado from the source of truth.
    fetchClientes();
  };

  const handleGeradorCreated = (novo: GeradorAtg) => {
    setGeradoresByCliente((prev) => {
      const list = prev[novo.omie_cliente_id] || [];
      return { ...prev, [novo.omie_cliente_id]: [...list, novo] };
    });
    fetchClientes();
  };

  return (
    <div id="clientes-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-500" />
            <span>Clientes & Geradores</span>
          </h1>
          <p className="text-sm text-slate-500">
            Revise, corrija e valide os cadastros de clientes, geradores e fichas de levantamento.
          </p>
        </div>
      </div>

      <FilterBar
        id="clientes-filters"
        searchPlaceholder="Buscar por razão social, nome fantasia ou CNPJ..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, idx) => (
            <div key={idx} className="h-24 bg-white border border-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto shadow-soft">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Falha ao carregar clientes</h3>
          <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
          <button
            onClick={fetchClientes}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          id="clientes-empty"
          title="Nenhum cliente encontrado"
          description="Nenhum registro encontrado para os filtros aplicados."
          actionText={hasActiveFilters ? "Limpar filtros" : undefined}
          onAction={hasActiveFilters ? handleClearFilters : undefined}
        />
      ) : (
        <div className="space-y-3" id="clientes-list">
          {filteredList.map((cliente) => {
            const isExpanded = expandedId === cliente.id;
            const estadoInfo = ESTADO_INFO[cliente.estado] || ESTADO_INFO.SEM_ICLASS;
            const geradores = geradoresByCliente[cliente.id] || [];

            return (
              <div
                key={cliente.id}
                id={`cliente-card-${cliente.id}`}
                className="bg-white border border-slate-200/80 rounded-2xl shadow-soft overflow-hidden transition-all"
              >
                {/* Collapsed header */}
                <button
                  onClick={() => toggleExpand(cliente.id)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-800 truncate">{cliente.razao_social || "—"}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoInfo.badge}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${estadoInfo.dot}`} />
                        {estadoInfo.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-1">CNPJ: {cliente.cnpj_raw || "—"}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-brand-500" />
                      {cliente.n_geradores} gerador{cliente.n_geradores === 1 ? "" : "es"}
                      {cliente.n_geradores > 0 && (
                        <span className="text-slate-400 font-normal">
                          &nbsp;· {cliente.n_com_ficha} com ficha · {cliente.n_validados} validado{cliente.n_validados === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  </div>
                  <motion.div
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="shrink-0"
                  >
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  </motion.div>
                </button>

                {/* Expanded content */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      key="expanded"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-slate-100 p-5 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Omie</h4>
                            <div className="text-xs space-y-1.5">
                              <p><span className="text-slate-400">Razão Social:</span> <span className="font-semibold text-slate-700">{cliente.razao_social || "—"}</span></p>
                              <p><span className="text-slate-400">Nome Fantasia:</span> <span className="font-semibold text-slate-700">{cliente.nome_fantasia || "—"}</span></p>
                              <p><span className="text-slate-400">CNPJ:</span> <span className="font-mono font-semibold text-slate-700">{cliente.cnpj_raw || "—"}</span></p>
                              <p><span className="text-slate-400">Código Omie:</span> <span className="font-mono font-semibold text-slate-700">{cliente.codigo_omie || "—"}</span></p>
                            </div>
                          </div>
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">iClass</h4>
                            <div className="text-xs space-y-1.5">
                              <p><span className="text-slate-400">ID Encontrado:</span> <span className="font-mono font-semibold text-slate-700">{cliente.iclass_id_encontrado ?? "—"}</span></p>
                              <p><span className="text-slate-400">Código do Contrato:</span> <span className="font-mono font-semibold text-slate-700">{cliente.iclass_codigo_encontrado || "—"}</span></p>
                              <p><span className="text-slate-400">Status Conferência:</span> <span className="font-semibold text-slate-700">{cliente.status_conferencia || "—"}</span></p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => handleValidarCliente(cliente)}
                            disabled={validating}
                            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer disabled:opacity-60 ${
                              cliente.cliente_validado
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                                : "bg-brand-500 text-white hover:bg-brand-600"
                            }`}
                          >
                            {cliente.cliente_validado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                            <span>{cliente.cliente_validado ? "Validado (clique para reabrir)" : "Conferido"}</span>
                          </button>

                          <button
                            onClick={() => handleToggleGeradores(cliente.id)}
                            className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{showGeradoresFor === cliente.id ? "Ocultar Geradores" : "Ver Geradores"}</span>
                          </button>

                          {cliente.estado !== "SEM_ICLASS" && (
                            <button
                              onClick={() => setAddGeradorForCliente(cliente)}
                              className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Adicionar Gerador</span>
                            </button>
                          )}
                        </div>

                        <AnimatePresence initial={false}>
                          {showGeradoresFor === cliente.id && (
                            <motion.div
                              key="geradores"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden"
                            >
                              <div className="pt-4 border-t border-slate-100">
                                {loadingGeradores && !geradoresByCliente[cliente.id] ? (
                                  <div className="space-y-2">
                                    {[...Array(2)].map((_, idx) => (
                                      <div key={idx} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
                                    ))}
                                  </div>
                                ) : geradores.length === 0 ? (
                                  <p className="text-xs text-slate-400 text-center py-4">Nenhum gerador cadastrado para este cliente.</p>
                                ) : (
                                  <div className="space-y-2">
                                    {geradores.map((g, idx) => (
                                      <motion.button
                                        key={g.id}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.2, delay: idx * 0.04, ease: "easeOut" }}
                                        onClick={() => setSelectedGerador(g)}
                                        className="w-full text-left flex items-center justify-between gap-3 p-3 bg-slate-50/60 hover:bg-slate-50 border border-slate-100 rounded-xl transition-colors cursor-pointer"
                                      >
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 truncate">{g.descricao || "Gerador sem descrição"}</p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            {g.fabricante || "—"} {g.modelo || ""} · Série: {g.num_serie || "—"}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {g.ficha_validada_por_humano && (
                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold px-1.5 py-0.5 rounded">VALIDADO</span>
                                          )}
                                          {!g.ficha_levantamento && (
                                            <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-bold px-1.5 py-0.5 rounded">SEM FICHA</span>
                                          )}
                                          {!g.ativo_id && (
                                            <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[9px] font-bold px-1.5 py-0.5 rounded">SEM ATIVO</span>
                                          )}
                                        </div>
                                      </motion.button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {selectedGerador && (
        <GeradorModal
          gerador={selectedGerador}
          usuario={currentUserEmail}
          onClose={() => setSelectedGerador(null)}
          onUpdated={(updated) => {
            handleGeradorUpdated(updated);
            setSelectedGerador(updated);
          }}
        />
      )}

      {addGeradorForCliente && (
        <AdicionarGeradorWizard
          cliente={addGeradorForCliente}
          usuario={currentUserEmail}
          onClose={() => setAddGeradorForCliente(null)}
          onCreated={(novo) => {
            handleGeradorCreated(novo);
            setAddGeradorForCliente(null);
            setShowGeradoresFor(novo.omie_cliente_id);
            setSelectedGerador(novo);
          }}
        />
      )}
    </div>
  );
}
