/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Edit3,
  RefreshCw
} from "lucide-react";
import { OrdemServico, Orcamento, PeriodType, DateRange } from "../types";
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

export default function OrdensServico() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search and Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterErro, setFilterErro] = useState("");

  const [periodType, setPeriodType] = useState<PeriodType>("mes");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "2026-06-01",
    endDate: "2026-06-30"
  });

  // Modal details
  const [selectedOS, setSelectedOS] = useState<OrdemServico | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editProcessada, setEditProcessada] = useState(false);
  const [editTipoErro, setEditTipoErro] = useState("");
  const [editOrcamentoId, setEditOrcamentoId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    const [osResult, orcResult] = await Promise.all([
      supabase.from("ordens_servico").select("*").order("criado_em", { ascending: false }),
      supabase.from("orcamentos").select("*").order("criado_em", { ascending: false })
    ]);

    if (osResult.error) {
      setError(osResult.error.message);
      toast.error("Erro ao carregar ordens de serviço.", { description: osResult.error.message });
    } else {
      setOrdens(osResult.data || []);
    }

    if (!orcResult.error) {
      setOrcamentos(orcResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Parse hash query parameters on mount or hash change
  useEffect(() => {
    const parseQueryParams = () => {
      const hash = window.location.hash;
      if (hash.includes("?")) {
        const queryStr = hash.split("?")[1];
        const params = new URLSearchParams(queryStr);
        const statusParam = params.get("status");
        if (statusParam === "erro") {
          setFilterStatus("false");
        } else if (statusParam === "processada") {
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

  // Error type list for the filter and dropdown
  const errorTypes = [
    "Inconsistência de valores",
    "Gerador não localizado",
    "Erro de faturamento",
    "Assinatura digital ausente",
    "Dados cadastrais incompletos"
  ];

  // Reset all filters
  const handleClearFilters = () => {
    setSearch("");
    setFilterStatus("");
    setFilterErro("");
    setPeriodType("mes");
    setDateRange({ startDate: "2026-06-01", endDate: "2026-06-30" });
    toast.info("Filtros redefinidos com sucesso.");
  };

  // Check if any filter is active
  const hasActiveFilters =
    search !== "" ||
    filterStatus !== "" ||
    filterErro !== "" ||
    periodType !== "mes";

  // Filter Ordens Servico list based on current filters
  const filteredList = ordens.filter((o) => {
    if (!isDateInRange(o.criado_em, dateRange)) return false;

    if (search) {
      const term = search.toLowerCase();
      const codeMatches = o.cod_os.toLowerCase().includes(term);
      const clientMatches = o.cliente_id.toLowerCase().includes(term);
      if (!codeMatches && !clientMatches) return false;
    }

    if (filterStatus) {
      const targetStatus = filterStatus === "true";
      if (o.processada !== targetStatus) return false;
    }

    if (filterErro && o.tipo_erro !== filterErro) return false;

    return true;
  });

  // Export to Excel function
  const handleExport = () => {
    if (filteredList.length === 0) {
      toast.error("Nenhum dado encontrado para exportação.");
      return;
    }

    const exportData = filteredList.map((o) => ({
      "Código O.S.": o.cod_os,
      "Cliente (ID)": o.cliente_id,
      "Status": o.processada ? "Processada" : "Não Processada",
      "Orçamento Vinculado": o.orcamento_id || "Nenhum",
      "Tipo de Erro": o.tipo_erro || "Nenhum",
      "Criado Em": formatDate(o.criado_em)
    }));

    exportToExcel(exportData, `Relatorio_OS_${new Date().toISOString().split("T")[0]}`);
    toast.success("Relatório gerado com sucesso!");
  };

  // Open modal in View mode
  const handleOpenDetails = (os: OrdemServico) => {
    setSelectedOS(os);
    setIsEditMode(false);
    setEditProcessada(os.processada);
    setEditTipoErro(os.tipo_erro || "");
    setEditOrcamentoId(os.orcamento_id || "");
  };

  // Trigger edit save
  const handleSaveOS = async () => {
    if (!selectedOS || !supabase) return;

    if (!editProcessada && !editTipoErro.trim()) {
      toast.error("O preenchimento do tipo de erro é obrigatório quando a O.S. não está processada.", {
        duration: 4000
      });
      return;
    }

    setSaving(true);

    const updates = {
      processada: editProcessada,
      tipo_erro: editProcessada ? null : editTipoErro,
      orcamento_id: editOrcamentoId || null
    };

    const { error: updateError } = await supabase
      .from("ordens_servico")
      .update(updates)
      .eq("id", selectedOS.id);

    setSaving(false);

    if (updateError) {
      toast.error("Erro ao atualizar a ordem de serviço.", { description: updateError.message });
      return;
    }

    setOrdens((prev) =>
      prev.map((o) => (o.id === selectedOS.id ? { ...o, ...updates, atualizado_em: new Date().toISOString() } : o))
    );
    toast.success(`Ordem de Serviço ${selectedOS.cod_os} atualizada com sucesso!`);
    setSelectedOS(null);
  };

  // Setup options for FilterBar dropdown selects
  const filterFields = [
    {
      key: "status",
      label: "Status",
      value: filterStatus,
      options: [
        { value: "true", label: "Processada" },
        { value: "false", label: "Não Processada" }
      ],
      onChange: setFilterStatus
    },
    {
      key: "erro",
      label: "Tipo de Erro",
      value: filterErro,
      options: errorTypes.map((e) => ({ value: e, label: e })),
      onChange: setFilterErro
    }
  ];

  return (
    <div id="os-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#16A34A]" />
            <span>Ordens de Serviço (O.S.)</span>
          </h1>
          <p className="text-sm text-slate-500">
            Gerencie e filtre ordens de serviço geradas a partir de atendimentos.
          </p>
        </div>

        {/* Period Filter */}
        <PeriodFilter
          id="os-period"
          initialType={periodType}
          initialRange={dateRange}
          onChange={(type, range) => {
            setPeriodType(type);
            setDateRange(range);
          }}
        />
      </div>

      {/* Filter Bar with Search and Select dropdowns */}
      <FilterBar
        id="os-filters"
        searchPlaceholder="Buscar por código ou cliente..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        rightElement={
          <button
            id="os-export-btn"
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

      {/* Main OS Listing Table */}
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
            <h3 className="text-base font-bold text-slate-800">Falha ao carregar Ordens de Serviço</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#16A34A] text-white rounded-xl text-xs font-semibold hover:bg-[#15803d] transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="os-table">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-6">Código O.S.</th>
                <th className="py-3 px-6">Cliente</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Orçamento Vinculado</th>
                <th className="py-3 px-6">Tipo de Erro</th>
                <th className="py-3 px-6">Data de Criação</th>
                <th className="py-3 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-6 text-center">
                    <EmptyState
                      id="os-empty-state"
                      title="Nenhuma O.S. encontrada"
                      description="Nenhum registro encontrado para os filtros aplicados."
                      actionText={hasActiveFilters ? "Limpar todos os filtros" : undefined}
                      onAction={hasActiveFilters ? handleClearFilters : undefined}
                    />
                  </td>
                </tr>
              ) : (
                filteredList.map((os) => {
                  return (
                    <tr
                      key={os.id}
                      id={`os-row-${os.cod_os}`}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                      onClick={() => handleOpenDetails(os)}
                    >
                      {/* Code */}
                      <td className="py-4 px-6 font-bold text-slate-800">{os.cod_os}</td>

                      {/* Client */}
                      <td className="py-4 px-6 font-semibold text-slate-700 max-w-[200px] truncate" title={os.cliente_id}>
                        {clienteLabel(os.cliente_id)}
                      </td>

                      {/* Status Dot */}
                      <td className="py-4 px-6">
                        <span className="flex items-center gap-1.5 font-semibold">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              os.processada ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          ></span>
                          <span className={os.processada ? "text-slate-700" : "text-rose-600"}>
                            {os.processada ? "Processada" : "Não Processada"}
                          </span>
                        </span>
                      </td>

                      {/* Linked budget */}
                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {os.orcamento_id ? (
                          <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {orcamentos.find((o) => o.id === os.orcamento_id)?.cod_orcamento || os.orcamento_id}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-normal italic">Nenhum</span>
                        )}
                      </td>

                      {/* Error Badge */}
                      <td className="py-4 px-6">
                        {!os.processada ? (
                          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 border border-rose-100 rounded-lg">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{os.tipo_erro || "Erro não especificado"}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic font-normal">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-4 px-6 text-slate-500 font-medium">{formatDate(os.criado_em)}</td>

                      {/* Action */}
                      <td className="py-4 px-6 text-right">
                        <button
                          id={`os-action-view-${os.cod_os}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(os);
                          }}
                          className="p-1.5 text-slate-400 hover:text-[#16A34A] hover:bg-emerald-50 rounded-lg transition-all"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
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
      {selectedOS && (
        <Modal
          id="os-detail-modal"
          isOpen={true}
          onClose={() => setSelectedOS(null)}
          title={`Detalhes da Ordem de Serviço: ${selectedOS.cod_os}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <div />
              <div className="flex gap-2">
                <button
                  id="os-modal-close-btn"
                  onClick={() => setSelectedOS(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {!isEditMode ? (
                  <button
                    id="os-modal-edit-btn"
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 bg-[#16A34A] text-white rounded-xl font-medium text-xs hover:bg-[#15803d] transition-colors flex items-center gap-1 shadow-soft cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar O.S.</span>
                  </button>
                ) : (
                  <button
                    id="os-modal-save-btn"
                    onClick={handleSaveOS}
                    disabled={saving}
                    className="px-4 py-2 bg-[#16A34A] text-white rounded-xl font-medium text-xs hover:bg-[#15803d] transition-colors shadow-soft cursor-pointer disabled:opacity-60"
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
              editProcessada ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                editProcessada ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
              }`}>
                {editProcessada ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide">Status Processamento</h4>
                <p className="text-sm font-semibold text-slate-800">
                  {editProcessada ? "Processada com Sucesso" : "Pendente de Correção"}
                </p>
              </div>
            </div>

            {/* Read-Only Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Cliente</span>
                <p className="text-xs font-bold text-slate-700 mt-1" title={selectedOS.cliente_id}>
                  {clienteLabel(selectedOS.cliente_id)}
                </p>
              </div>
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Data de Emissão</span>
                <p className="text-xs font-bold text-slate-700 mt-1">{formatDate(selectedOS.criado_em)}</p>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Configuração de Processamento</h4>

              {/* Status Toggle */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Mudar Status</label>
                <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
                  <button
                    id="edit-os-status-false"
                    disabled={!isEditMode}
                    onClick={() => {
                      setEditProcessada(false);
                      setEditTipoErro("Inconsistência de valores"); // Default choice
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      !editProcessada
                        ? "bg-white text-rose-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-700 disabled:pointer-events-none"
                    }`}
                  >
                    Não Processada
                  </button>
                  <button
                    id="edit-os-status-true"
                    disabled={!isEditMode}
                    onClick={() => {
                      setEditProcessada(true);
                      setEditTipoErro("");
                    }}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      editProcessada
                        ? "bg-white text-emerald-600 shadow-sm"
                        : "text-slate-400 hover:text-slate-700 disabled:pointer-events-none"
                    }`}
                  >
                    Processada
                  </button>
                </div>
              </div>

              {/* Error type selection - Rendered only if OS is NOT processed */}
              {!editProcessada && (
                <div className="animate-fade-in space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-500">
                    Tipo de Erro <span className="text-rose-500">*</span>
                  </label>
                  <select
                    id="edit-os-tipo-erro"
                    disabled={!isEditMode}
                    value={editTipoErro}
                    onChange={(e) => setEditTipoErro(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#16A34A] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                  >
                    <option value="">Selecione o erro...</option>
                    {errorTypes.map((err) => (
                      <option key={err} value={err}>
                        {err}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Linked budget selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Orçamento Vinculado</label>
                <select
                  id="edit-os-orcamento-id"
                  disabled={!isEditMode}
                  value={editOrcamentoId}
                  onChange={(e) => setEditOrcamentoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#16A34A] focus:border-transparent disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
                >
                  <option value="">Nenhum</option>
                  {orcamentos
                    .filter((x) => x.cliente_id === selectedOS.cliente_id)
                    .map((orc) => (
                      <option key={orc.id} value={orc.id}>
                        {orc.cod_orcamento} {orc.processada ? "(Faturado)" : "(Aberto)"}
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
