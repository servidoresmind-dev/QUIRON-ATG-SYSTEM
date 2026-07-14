/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  Zap,
  Search,
  Eye,
  Edit3,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { GeradorFicha, OmieCliente } from "../types";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { toast } from "sonner";
import FilterBar from "../components/ui/FilterBar";
import EmptyState from "../components/ui/EmptyState";
import Modal from "../components/ui/Modal";
import OmieSearchModal from "../components/Geradores/OmieSearchModal";

const FIELD_LABEL = "block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1";
const FIELD_INPUT =
  "w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-4 border-t border-slate-100 first:pt-0 first:border-0">
      {children}
    </h4>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  className
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={FIELD_LABEL}>{label}</label>
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD_INPUT}
      />
    </div>
  );
}

const FILTER_GROUPS: { key: string; label: string }[] = [
  { key: "combustivel", label: "Combustível" },
  { key: "lubrificante", label: "Lubrificante" },
  { key: "agua", label: "Água" },
  { key: "separador", label: "Separador" },
  { key: "ar", label: "Ar" }
];

export default function Geradores() {
  const [geradores, setGeradores] = useState<GeradorFicha[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [selected, setSelected] = useState<GeradorFicha | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<GeradorFicha>>({});
  const [saving, setSaving] = useState(false);
  const [showOmieSearch, setShowOmieSearch] = useState(false);

  const fetchGeradores = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("geradores")
      .select("*")
      .order("updated_at", { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      toast.error("Erro ao carregar geradores.", { description: fetchError.message });
    } else {
      setGeradores(data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchGeradores();
  }, []);

  const handleClearFilters = () => {
    setSearch("");
    setFilterStatus("");
    toast.info("Filtros redefinidos com sucesso.");
  };

  const hasActiveFilters = search !== "" || filterStatus !== "";

  const filteredList = useMemo(() => {
    return geradores.filter((g) => {
      if (search) {
        const term = search.toLowerCase();
        const matches =
          g.cliente_nome?.toLowerCase().includes(term) ||
          g.cliente_cnpj?.toLowerCase().includes(term) ||
          g.equipamento_descricao?.toLowerCase().includes(term) ||
          g.os_ficha_id?.toLowerCase().includes(term);
        if (!matches) return false;
      }
      if (filterStatus && g.status_preenchimento !== filterStatus) return false;
      return true;
    });
  }, [geradores, search, filterStatus]);

  const totalPages = Math.ceil(filteredList.length / itemsPerPage) || 1;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterStatus]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredList.slice(start, start + itemsPerPage);
  }, [filteredList, currentPage]);

  const filterFields = [
    {
      key: "status",
      label: "Status",
      value: filterStatus,
      options: [
        { value: "COMPLETO", label: "Completo" },
        { value: "PENDENTE_ADM", label: "Pendente Admin" }
      ],
      onChange: setFilterStatus
    }
  ];

  const handleOpenDetails = (g: GeradorFicha) => {
    setSelected(g);
    setIsEditMode(false);
    setEditForm(g);
  };

  const handleField = (field: keyof GeradorFicha, value: string | boolean | null) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const strField = (field: keyof GeradorFicha) => (editForm[field] as string) ?? "";

  const handleSave = async () => {
    if (!selected || !supabase) return;

    setSaving(true);

    // Only send editable fields — the *_iclass identifiers stay untouched.
    const {
      id,
      os_ficha_id,
      ativo_id_iclass,
      equipamento_codigo_iclass,
      cliente_codigo_iclass,
      created_at,
      updated_at,
      ...editable
    } = editForm;

    const { error: updateError } = await supabase
      .from("geradores")
      .update(editable)
      .eq("id", selected.id);

    setSaving(false);

    if (updateError) {
      toast.error("Erro ao salvar alterações.", { description: updateError.message });
      return;
    }

    setGeradores((prev) =>
      prev.map((g) => (g.id === selected.id ? { ...g, ...editable, updated_at: new Date().toISOString() } : g))
    );
    toast.success(`Gerador da ficha ${selected.os_ficha_id} atualizado com sucesso!`);
    setSelected(null);
  };

  const handleSelectOmie = (cliente: OmieCliente) => {
    handleField("cliente_codigo_omie", cliente.cod_omie);
    toast.success(`Código Omie ${cliente.cod_omie} vinculado a ${cliente.nome}.`);
  };

  return (
    <div id="geradores-page" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-brand-500" />
            <span>Geradores</span>
          </h1>
          <p className="text-sm text-slate-500">
            Fichas técnicas de geradores integradas via iClass, com ajuste manual e vínculo de código Omie.
          </p>
        </div>
      </div>

      <FilterBar
        id="geradores-filters"
        searchPlaceholder="Buscar por cliente, CNPJ, equipamento ou ficha..."
        searchValue={search}
        onSearchChange={setSearch}
        filters={filterFields}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

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
            <h3 className="text-base font-bold text-slate-800">Falha ao carregar Geradores</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
            <button
              onClick={fetchGeradores}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="geradores-table">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3 px-6">Equipamento</th>
                  <th className="py-3 px-6">Cliente</th>
                  <th className="py-3 px-6">CNPJ</th>
                  <th className="py-3 px-6">Código Omie</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-6 text-center">
                      <EmptyState
                        id="geradores-empty-state"
                        title="Nenhum gerador encontrado"
                        description="Nenhum registro encontrado para os filtros aplicados."
                        actionText={hasActiveFilters ? "Limpar todos os filtros" : undefined}
                        onAction={hasActiveFilters ? handleClearFilters : undefined}
                      />
                    </td>
                  </tr>
                ) : (
                  paginated.map((g) => (
                    <tr
                      key={g.id}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenDetails(g)}
                    >
                      <td className="py-4 px-6 font-semibold text-slate-800 max-w-xs truncate">
                        {g.equipamento_descricao || "—"}
                        <span className="block text-[10px] text-slate-400 font-normal">Ficha: {g.os_ficha_id}</span>
                      </td>
                      <td className="py-4 px-6 max-w-[220px] truncate">{g.cliente_nome || "—"}</td>
                      <td className="py-4 px-6 font-mono">{g.cliente_cnpj || "—"}</td>
                      <td className="py-4 px-6">
                        {g.cliente_codigo_omie ? (
                          <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {g.cliente_codigo_omie}
                          </span>
                        ) : (
                          <span className="bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            Não vinculado
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                            g.status_preenchimento === "COMPLETO"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                              : "bg-amber-50 text-amber-700 border border-amber-100"
                          }`}
                        >
                          {g.status_preenchimento === "COMPLETO" ? "Completo" : "Pendente Admin"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetails(g);
                          }}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all"
                          title="Ver detalhes"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && filteredList.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <div>
              Exibindo <span className="font-bold text-slate-700">{paginated.length}</span> de{" "}
              <span className="font-bold text-slate-700">{filteredList.length}</span> geradores
            </div>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 font-bold bg-white border border-slate-200 rounded-lg text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail / Edit Modal */}
      {selected && (
        <Modal
          id="gerador-detail-modal"
          isOpen={true}
          onClose={() => setSelected(null)}
          title={`Ficha do Gerador: ${selected.os_ficha_id}`}
          size="xl"
          footer={
            <div className="flex items-center justify-between w-full">
              <div>
                {selected.pendencias && (
                  <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 bg-amber-50 px-2 py-1 rounded max-w-md truncate">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{selected.pendencias}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Fechar
                </button>
                {!isEditMode ? (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 bg-brand-500 text-white rounded-xl font-medium text-xs hover:bg-brand-600 transition-colors flex items-center gap-1 shadow-soft cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Ajustar Manualmente</span>
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-brand-500 text-white rounded-xl font-medium text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
                  >
                    {saving ? "Salvando..." : "Salvar Alterações"}
                  </button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Identificação (somente leitura — origem iClass) */}
            <SectionTitle>Identificação (iClass)</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ficha O.S." value={selected.os_ficha_id} onChange={() => {}} disabled />
              <Field label="ID do Ativo" value={selected.ativo_id_iclass?.toString() ?? ""} onChange={() => {}} disabled />
              <Field label="Código Equipamento" value={selected.equipamento_codigo_iclass ?? ""} onChange={() => {}} disabled />
            </div>

            {/* Cliente */}
            <SectionTitle>Cliente</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={strField("cliente_nome")} onChange={(v) => handleField("cliente_nome", v)} disabled={!isEditMode} />
              <Field label="CNPJ" value={strField("cliente_cnpj")} onChange={(v) => handleField("cliente_cnpj", v)} disabled={!isEditMode} />
              <Field label="Nome Fantasia" value={strField("cliente_nome_fantasia")} onChange={(v) => handleField("cliente_nome_fantasia", v)} disabled={!isEditMode} />
              <Field label="Razão Social" value={strField("cliente_razao_social")} onChange={(v) => handleField("cliente_razao_social", v)} disabled={!isEditMode} />
              <div>
                <label className={FIELD_LABEL}>Código Omie</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={strField("cliente_codigo_omie")}
                    disabled={!isEditMode}
                    onChange={(e) => handleField("cliente_codigo_omie", e.target.value)}
                    className={FIELD_INPUT}
                  />
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => setShowOmieSearch(true)}
                      title="Buscar Código do Cliente no Omie"
                      className="px-3 py-2 bg-brand-50 border border-brand-100 text-brand-700 rounded-xl text-xs font-semibold hover:bg-brand-100 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Omie</span>
                    </button>
                  )}
                </div>
              </div>
              <Field label="Código Cliente (iClass)" value={selected.cliente_codigo_iclass ?? ""} onChange={() => {}} disabled />
            </div>

            {/* Equipamento */}
            <SectionTitle>Equipamento</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Descrição" value={strField("equipamento_descricao")} onChange={(v) => handleField("equipamento_descricao", v)} disabled={!isEditMode} />
            </div>

            {/* Gerador */}
            <SectionTitle>Gerador</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Fabricante" value={strField("gerador_fabricante")} onChange={(v) => handleField("gerador_fabricante", v)} disabled={!isEditMode} />
              <Field label="Ano" value={strField("gerador_ano")} onChange={(v) => handleField("gerador_ano", v)} disabled={!isEditMode} />
              <Field label="Potência" value={strField("gerador_potencia")} onChange={(v) => handleField("gerador_potencia", v)} disabled={!isEditMode} />
              <Field label="Tensão" value={strField("gerador_tensao")} onChange={(v) => handleField("gerador_tensao", v)} disabled={!isEditMode} />
              <Field label="Número de Montagem" value={strField("gerador_numero_montagem")} onChange={(v) => handleField("gerador_numero_montagem", v)} disabled={!isEditMode} className="col-span-2" />
            </div>

            {/* Motor */}
            <SectionTitle>Motor</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fabricante" value={strField("motor_fabricante")} onChange={(v) => handleField("motor_fabricante", v)} disabled={!isEditMode} />
              <Field label="Modelo" value={strField("motor_modelo")} onChange={(v) => handleField("motor_modelo", v)} disabled={!isEditMode} />
              <Field label="Número de Série" value={strField("motor_numero_serie")} onChange={(v) => handleField("motor_numero_serie", v)} disabled={!isEditMode} />
              <Field label="Óleo (Baldes)" value={strField("motor_oleo_baldes")} onChange={(v) => handleField("motor_oleo_baldes", v)} disabled={!isEditMode} />
            </div>

            {/* Alternador */}
            <SectionTitle>Alternador</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Fabricante" value={strField("alternador_fabricante")} onChange={(v) => handleField("alternador_fabricante", v)} disabled={!isEditMode} />
              <Field label="Modelo" value={strField("alternador_modelo")} onChange={(v) => handleField("alternador_modelo", v)} disabled={!isEditMode} />
              <Field label="Número de Série" value={strField("alternador_numero_serie")} onChange={(v) => handleField("alternador_numero_serie", v)} disabled={!isEditMode} />
            </div>

            {/* Controlador */}
            <SectionTitle>Controlador</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fabricante" value={strField("controlador_fabricante")} onChange={(v) => handleField("controlador_fabricante", v)} disabled={!isEditMode} />
              <Field label="Modelo" value={strField("controlador_modelo")} onChange={(v) => handleField("controlador_modelo", v)} disabled={!isEditMode} />
            </div>

            {/* Bomba Injetora */}
            <SectionTitle>Bomba Injetora</SectionTitle>
            <div className="grid grid-cols-4 gap-3 items-end">
              <div>
                <label className={FIELD_LABEL}>Possui</label>
                <select
                  disabled={!isEditMode}
                  value={editForm.bomba_injetora_possui === true ? "true" : editForm.bomba_injetora_possui === false ? "false" : ""}
                  onChange={(e) => handleField("bomba_injetora_possui", e.target.value === "" ? null : e.target.value === "true")}
                  className={FIELD_INPUT + " cursor-pointer"}
                >
                  <option value="">—</option>
                  <option value="true">Sim</option>
                  <option value="false">Não</option>
                </select>
              </div>
              <Field label="Fabricante" value={strField("bomba_injetora_fabricante")} onChange={(v) => handleField("bomba_injetora_fabricante", v)} disabled={!isEditMode} />
              <Field label="Modelo" value={strField("bomba_injetora_modelo")} onChange={(v) => handleField("bomba_injetora_modelo", v)} disabled={!isEditMode} />
              <Field label="Número" value={strField("bomba_injetora_numero")} onChange={(v) => handleField("bomba_injetora_numero", v)} disabled={!isEditMode} />
            </div>

            {/* Bateria */}
            <SectionTitle>Bateria</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantidade" value={strField("bateria_quantidade")} onChange={(v) => handleField("bateria_quantidade", v)} disabled={!isEditMode} />
              <Field label="Capacidade" value={strField("bateria_capacidade")} onChange={(v) => handleField("bateria_capacidade", v)} disabled={!isEditMode} />
            </div>

            {/* Filtros */}
            <SectionTitle>Filtros</SectionTitle>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 text-[9px] uppercase font-bold text-slate-400">
                    <th className="py-2 px-3">Filtro</th>
                    <th className="py-2 px-3" colSpan={3}>Primário (Qtd / Código / Fabricante)</th>
                    <th className="py-2 px-3" colSpan={3}>Secundário (Qtd / Código / Fabricante)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {FILTER_GROUPS.map((group) => (
                    <tr key={group.key}>
                      <td className="py-2 px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">{group.label}</td>
                      {(["prim", "sec"] as const).flatMap((side) =>
                        (["qtd", "codigo", "fabricante"] as const).map((suffix) => {
                          const field = `filtro_${group.key}_${side}_${suffix}` as keyof GeradorFicha;
                          return (
                            <td key={field} className="py-1.5 px-1.5">
                              <input
                                type="text"
                                value={strField(field)}
                                disabled={!isEditMode}
                                onChange={(e) => handleField(field, e.target.value)}
                                className="w-full px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                              />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Radiador */}
            <SectionTitle>Radiador</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Medidas" value={strField("radiador_medidas")} onChange={(v) => handleField("radiador_medidas", v)} disabled={!isEditMode} />
            </div>

            {/* Status */}
            <SectionTitle>Status de Preenchimento</SectionTitle>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={FIELD_LABEL}>Status</label>
                <select
                  disabled={!isEditMode}
                  value={strField("status_preenchimento")}
                  onChange={(e) => handleField("status_preenchimento", e.target.value)}
                  className={FIELD_INPUT + " cursor-pointer"}
                >
                  <option value="COMPLETO">Completo</option>
                  <option value="PENDENTE_ADM">Pendente Admin</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL}>Pendências</label>
                <textarea
                  disabled={!isEditMode}
                  value={strField("pendencias")}
                  onChange={(e) => handleField("pendencias", e.target.value)}
                  rows={2}
                  className={FIELD_INPUT + " resize-none"}
                />
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Omie search sub-modal */}
      <OmieSearchModal
        isOpen={showOmieSearch}
        onClose={() => setShowOmieSearch(false)}
        onSelect={handleSelectOmie}
      />
    </div>
  );
}
