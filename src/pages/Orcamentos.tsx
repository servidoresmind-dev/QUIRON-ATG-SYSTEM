/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Receipt,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Edit3,
  RefreshCw
} from "lucide-react";
import { Orcamento, OrdemServico, PeriodType, DateRange } from "../types";
import { isDateInRange, formatDate } from "../utils/date";
import { exportToExcel } from "../utils/excel";
import PeriodFilter from "../components/ui/PeriodFilter";
import FilterBar from "../components/ui/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../utils/supabase";

// Display helper for cliente_id until a real `clientes` table exists
const clienteLabel = (id: string) => `Cliente ${id.slice(0, 8)}`;

export default function Orcamentos() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [periodType, setPeriodType] = useState<PeriodType>("mes");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "2026-06-01",
    endDate: "2026-06-30"
  });

  // Modal details
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editProcessada, setEditProcessada] = useState(false);
  const [editOSId, setEditOSId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    const [orcResult, osResult] = await Promise.all([
      supabase.from("orcamentos").select("*").order("criado_em", { ascending: false }),
      supabase.from("ordens_servico").select("*").order("criado_em", { ascending: false })
    ]);

    if (orcResult.error) {
      setError(orcResult.error.message);
      toast.error("Erro ao carregar orçamentos.", { description: orcResult.error.message });
    } else {
      setOrcamentos(orcResult.data || []);
    }

    if (!osResult.error) {
      setOrdens(osResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Parse query parameters
  useEffect(() => {
    const parseQueryParams = () => {
      const hash = window.location.hash;
      if (hash.includes("?")) {
        const queryStr = hash.split("?")[1];
        const params = new URLSearchParams(queryStr);
        const statusParam = params.get("status");
        if (statusParam === "processada") {
          setFilterStatus("true");
        }
      }
    };
    parseQueryParams();
    window.addEventListener("hashchange", parseQueryParams);
    return () => {
      window.removeEventListener("hashchange", parseQueryParams);
    };
  }, []);

  // Reset all filters
  const handleClearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setPeriodType("mes");
    setDateRange({ startDate: "2026-06-01", endDate: "2026-06-30" });
    toast.info("Filtros redefinidos com sucesso.");
  };

  // Check if any filter is active
  const hasActiveFilters =
    search !== "" ||
    filterStatus !== "" ||
    periodType !== "mes";

  // Filter budgets list based on current filters
  const filteredList = orcamentos.filter((o) => {
    if (!isDateInRange(o.criado_em, dateRange)) return false;

    if (search) {
      const term = search.toLowerCase();
      const codeMatches = o.cod_orcamento.toLowerCase().includes(term);
      const clientMatches = o.cliente_id.toLowerCase().includes(term);
      if (!codeMatches && !clientMatches) return false;
    }

    if (filterStatus) {
      const targetStatus = filterStatus === "true";
      if (o.processada !== targetStatus) return false;
    }

    return true;
  });

  // Export to Excel function
  const handleExport = () => {
    if (filteredList.length === 0) {
      toast.error("Nenhum orçamento encontrado para exportação.");
      return;
    }

    const exportData = filteredList.map((o) => ({
      "Código Orçamento": o.cod_orcamento,
      "Cliente (ID)": o.cliente_id,
      "Status": o.processada ? "Enviado p/ Faturamento" : "Aberto",
      "O.S. Vinculada": o.os_id || "Nenhuma",
      "Criado Em": formatDate(o.criado_em)
    }));

    exportToExcel(exportData, `Relatorio_Orcamentos_${new Date().toISOString().split("T")[0]}`);
    toast.success("Relatório gerado com sucesso!");
  };

  // Open modal in View mode
  const handleOpenDetails = (orc: Orcamento) => {
    setSelectedOrcamento(orc);
    setIsEditMode(false);
    setEditProcessada(orc.processada);
    setEditOSId(orc.os_id || "");
  };

  // Save edit changes
  const handleSaveOrcamento = async () => {
    if (!selectedOrcamento || !supabase) return;

    setSaving(true);

    const updates = {
      processada: editProcessada,
      os_id: editOSId || null
    };

    const { error: updateError } = await supabase
      .from("orcamentos")
      .update(updates)
      .eq("id", selectedOrcamento.id);

    setSaving(false);

    if (updateError) {
      toast.error("Erro ao atualizar o orçamento.", { description: updateError.message });
      return;
    }

    setOrcamentos((prev) =>
      prev.map((o) => (o.id === selectedOrcamento.id ? { ...o, ...updates, atualizado_em: new Date().toISOString() } : o))
    );
    toast.success(`Orçamento ${selectedOrcamento.cod_orcamento} atualizado com sucesso!`);
    setSelectedOrcamento(null);
  };

  const handleSendToInvoicing = async (orc: Orcamento) => {
    if (!supabase) return;

    const { error: updateError } = await supabase
      .from("orcamentos")
      .update({ processada: true })
      .eq("id", orc.id);

    if (updateError) {
      toast.error("Erro ao enviar orçamento para faturamento.", { description: updateError.message });
      return;
    }

    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orc.id ? { ...o, processada: true, atualizado_em: new Date().toISOString() } : o))
    );
    toast.success(`Orçamento ${orc.cod_orcamento} enviado para faturamento!`);
  };

  // FilterBar fields
  const filterFields = [
    {
      key: "status",
      label: "Status",
      value: filterStatus,
      options: [
        { value: "true", label: "Faturado (Processado)" },
        { value: "false", label: "Aberto (Não Processado)" }
      ],
      onChange: setFilterStatus
    }
  ];

  return (
    <div id="orcamentos-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-[#F2701C]" />
            <span>Orçamentos de Manutenção</span>
          </h1>
          <p className="text-sm text-slate-500">
            Acompanhe o faturamento e vinculação de orçamentos de geradores.
          </p>
        </div>

        {/* Period Filter */}
        <PeriodFilter
          id="orcamentos-period"
          initialType={periodType}
          initialRange={dateRange}
          onChange={(type, range) => {
            setPeriodType(type);
            setDateRange(range);
          }}
        />
      </div>

      {/* Filter Bar with Search and Selects */}
      <FilterBar
        id="orcamentos-filters"
        searchPlaceholder="Buscar por orçamento ou cliente..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        rightElement={
          <button
            id="orcamentos-export-btn"
            onClick={handleExport}
            disabled={filteredList.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-soft cursor-pointer ${
              filteredList.length === 0
                ? "bg-slate-50 border-slate-200 text-slate-300 pointer-events-none"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        }
      />

      {/* Budgets Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-soft">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="grid grid-cols-6 gap-4 py-3 border-b border-slate-50 animate-pulse">
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Falha ao carregar Orçamentos</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2701C] text-white rounded-xl text-xs font-semibold hover:bg-[#D4600F] transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="orcamentos-table">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-6">Código Orçamento</th>
                <th className="py-3 px-6">Cliente</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">O.S. Vinculada</th>
                <th className="py-3 px-6">Data de Criação</th>
                <th className="py-3 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-6 text-center">
                    <EmptyState
                      id="orcamentos-empty-state"
                      title="Nenhum orçamento encontrado"
                      description="Nenhum registro encontrado para os filtros aplicados."
                      actionText={hasActiveFilters ? "Limpar todos os filtros" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredList.map((orc) => {
                  return (
                    <tr
                      key={orc.id}
                      id={`orc-row-${orc.cod_orcamento}`}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetails(orc)}
                    >
                      {/* Code */}
                      <td className="py-4 px-6 font-bold text-slate-800">{orc.cod_orcamento}</td>

                      {/* Client */}
                      <td className="py-4 px-6 font-semibold text-slate-700 max-w-[200px] truncate" title={orc.cliente_id}>
                        {clienteLabel(orc.cliente_id)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              orc.processada ? "bg-blue-500" : "bg-amber-500"
                            }`}
                          ></span>
                          <span className={orc.processada ? "text-slate-700" : "text-amber-600"}>
                            {orc.processada ? "Faturado" : "Em Aberto"}
                          </span>
                        </span>
                      </td>

                      {/* Linked O.S. */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {orc.os_id ? (
                          <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {ordens.find((o) => o.id === orc.os_id)?.cod_os || orc.os_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">Nenhuma</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-medium">{formatDate(orc.criado_em)}</td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!orc.processada && (
                            <button
                              id={`orc-action-faturar-${orc.cod_orcamento}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendToInvoicing(orc);
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold text-[#F2701C] bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg transition-all"
                              title="Enviar para Faturamento"
                            >
                              Faturar
                            </button>
                          )}
                          <button
                            id={`orc-action-view-${orc.cod_orcamento}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetails(orc);
                            }}
                            className="p-1.5 text-slate-400 hover:text-[#F2701C] hover:bg-orange-50 rounded-lg transition-all"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Details / Edit Modal */}
      {selectedOrcamento && (
        <Modal
          id="orcamento-detail-modal"
          isOpen={true}
          onClose={() => setSelectedOrcamento(null)}
          title={`Detalhes do Orçamento: ${selectedOrcamento.cod_orcamento}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <div />
              <div className="flex gap-2">
                <button
                  id="orcamento-modal-close-btn"
                  onClick={() => setSelectedOrcamento(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {!isEditMode ? (
                  <button
                    id="orcamento-modal-edit-btn"
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 bg-[#F2701C] text-white rounded-xl font-medium text-xs hover:bg-[#D4600F] transition-colors flex items-center gap-1 shadow-soft cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar Orçamento</span>
                  </button>
                ) : (
                  <button
                    id="orcamento-modal-save-btn"
                    onClick={handleSaveOrcamento}
                    disabled={saving}
                    className="px-4 py-2 bg-[#F2701C] text-white rounded-xl font-medium text-xs hover:bg-[#D4600F] transition-colors shadow-soft cursor-pointer disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-6">
            {/* Meta status panel */}
            <div className={`p-4 rounded-2xl flex items-center gap-3 border ${
              editProcessada ? "bg-blue-50/50 border-blue-100" : "bg-amber-50/50 border-amber-100"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                editProcessada ? "bg-blue-100 text-blue-600" : "bg-amber-100 text-amber-600"
              }`}>
                {editProcessada ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status Orçamento</h4>
                <p className="text-sm font-semibold text-slate-800">
                  {editProcessada ? "Enviado para Faturamento" : "Aberto (Aguardando Aprovação)"}
                </p>
              </div>
            </div>

            {/* Read-Only Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cliente</span>
                <p className="text-xs font-bold text-slate-700 mt-1" title={selectedOrcamento.cliente_id}>
                  {clienteLabel(selectedOrcamento.cliente_id)}
                </p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Data de Criação</span>
                <p className="text-xs font-bold text-slate-700 mt-1">{formatDate(selectedOrcamento.criado_em)}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configuração de Faturamento</h4>

              {/* Status Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mudar Status</label>
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                  <button
                    id="edit-orc-status-false"
                    disabled={!isEditMode}
                    onClick={() => setEditProcessada(false)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      !editProcessada
                        ? "bg-white text-amber-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-700 disabled:pointer-events-none"
                    }`}
                  >
                    Aberto (Não Processado)
                  </button>
                  <button
                    id="edit-orc-status-true"
                    disabled={!isEditMode}
                    onClick={() => setEditProcessada(true)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      editProcessada
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-700 disabled:pointer-events-none"
                    }`}
                  >
                    Faturado (Processado)
                  </button>
                </div>
              </div>

              {/* Linked O.S. selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Ordem de Serviço (O.S.) Vinculada</label>
                <select
                  id="edit-orc-os-id"
                  disabled={!isEditMode}
                  value={editOSId}
                  onChange={(e) => setEditOSId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#F2701C] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">Nenhuma</option>
                  {ordens
                    .filter((x) => x.cliente_id === selectedOrcamento.cliente_id)
                    .map((os) => (
                      <option key={os.id} value={os.id}>
                        {os.cod_os} {os.processada ? "(Processada)" : "(Pendente)"}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
