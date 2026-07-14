/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  FilePlus,
  Send,
  Plus,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { OrdemServico, Orcamento, PeriodType, DateRange } from "../types";
import { isDateInRange, formatDate, formatTime } from "../utils/date";
import PeriodFilter from "../components/ui/PeriodFilter";
import { navigateTo } from "../utils/navigation";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from "recharts";

const clienteLabel = (id: string) => `Cliente ${id.slice(0, 8)}`;

export default function Dashboard() {
  const [ordens, setOrdens] = useState<OrdemServico[]>([]);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [periodType, setPeriodType] = useState<PeriodType>("mes");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: "2026-06-01",
    endDate: "2026-06-30"
  });

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

    if (osResult.error || orcResult.error) {
      const message = osResult.error?.message || orcResult.error?.message || "Erro desconhecido";
      setError(message);
      toast.error("Erro ao carregar dados do painel.", { description: message });
    } else {
      setOrdens(osResult.data || []);
      setOrcamentos(orcResult.data || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter lists based on selected period
  const filteredOrdens = ordens.filter((o) => isDateInRange(o.criado_em, dateRange));
  const filteredOrcamentos = orcamentos.filter((o) => isDateInRange(o.criado_em, dateRange));

  // Compute KPI totals
  const osSuccess = filteredOrdens.filter((o) => o.processada).length;
  const osError = filteredOrdens.filter((o) => !o.processada).length;
  const orcCreated = filteredOrcamentos.length;
  const orcBilled = filteredOrcamentos.filter((o) => o.processada).length;

  // Combine O.S. and Budgets for recent activity (last 6 items)
  const recentActivity = [
    ...filteredOrdens.map((o) => ({
      id: o.id,
      type: "os" as const,
      cod: o.cod_os,
      cliente: clienteLabel(o.cliente_id),
      status: o.processada ? ("sucesso" as const) : ("erro" as const),
      date: o.criado_em,
      detail: o.tipo_erro
    })),
    ...filteredOrcamentos.map((o) => ({
      id: o.id,
      type: "orcamento" as const,
      cod: o.cod_orcamento,
      cliente: clienteLabel(o.cliente_id),
      status: o.processada ? ("faturado" as const) : ("aberto" as const),
      date: o.criado_em,
      detail: o.processada ? "Enviado p/ Faturamento" : "Aguardando aprovação"
    }))
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Generate Recharts Chart Data (e.g. daily breakdown in the date range)
  const getChartData = () => {
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const datesMap: Record<string, { name: string; Sucesso: number; Erros: number; Orcamentos: number }> = {};

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;
      const name = `${dd}/${mm}`;
      datesMap[key] = { name, Sucesso: 0, Erros: 0, Orcamentos: 0 };
    }

    filteredOrdens.forEach((o) => {
      const key = o.criado_em.split("T")[0];
      if (datesMap[key]) {
        if (o.processada) {
          datesMap[key].Sucesso += 1;
        } else {
          datesMap[key].Erros += 1;
        }
      }
    });

    filteredOrcamentos.forEach((o) => {
      const key = o.criado_em.split("T")[0];
      if (datesMap[key]) {
        datesMap[key].Orcamentos += 1;
      }
    });

    return Object.values(datesMap);
  };

  const chartData = getChartData();

  // Find index of max value to highlight it
  const maxIdx = chartData.reduce(
    (maxIndex, current, currentIndex, arr) =>
      current.Sucesso > arr[maxIndex].Sucesso ? currentIndex : maxIndex,
    0
  );

  if (error) {
    return (
      <div id="dashboard-page" className="space-y-8 animate-fade-in">
        <div className="bg-white border border-slate-200/50 rounded-[24px] p-12 text-center max-w-md mx-auto shadow-soft">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Falha ao carregar o painel</h3>
          <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B5577] text-white rounded-xl text-xs font-semibold hover:bg-[#08435e] transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="dashboard-page" className="space-y-8 animate-fade-in">

      {/* 1. Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6" id="dashboard-header">
        <div>
          <h1 className="text-3.5xl font-light text-slate-800 tracking-tight leading-none">
            Painel <span className="font-bold text-slate-900">Operacional</span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            ATG | SISTEMA DE ORDEM DE SERVIÇOS E ORÇAMENTOS
          </p>
        </div>

        {/* Date display & Filters Capsule */}
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter
            id="dashboard-period"
            initialType={periodType}
            initialRange={dateRange}
            onChange={(type, range) => {
              setPeriodType(type);
              setDateRange(range);
            }}
          />

          <button
            id="dashboard-new-orc-header-btn"
            onClick={() => navigateTo("orcamentos")}
            className="px-4 py-2.5 bg-[#0B5577] hover:bg-[#083E58] text-white rounded-full font-bold text-xs shadow-md shadow-[#0B5577]/10 hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Orçamento</span>
          </button>
        </div>
      </div>

      {/* 2. LINHA 1 — 4 cards de KPI lado a lado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" id="kpi-grid">

        {/* Card 1: O.S. Processadas com Sucesso */}
        <div
          id="kpi-os-sucesso"
          className="bg-white border border-slate-200/50 rounded-[24px] p-6 shadow-soft hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">O.S. Processadas</span>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-[#16A34A] shadow-xs">
              <CheckCircle2 className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight block">
                {loading ? "—" : osSuccess}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">no período</span>
            </div>
          </div>
        </div>

        {/* Card 2: O.S. Não Processadas (Erros) */}
        <div
          id="kpi-os-erros"
          onClick={() => navigateTo("ordens-servico?status=erro")}
          className="bg-white border border-slate-200/50 rounded-[24px] p-6 shadow-soft hover:shadow-md transition-all duration-300 cursor-pointer group hover:border-rose-100"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">O.S. com Erro</span>
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-[#DC2626] shadow-xs group-hover:scale-110 transition-transform">
              <XCircle className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight block text-rose-600">
                {loading ? "—" : osError}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1 group-hover:text-[#DC2626] transition-colors">Ver detalhes →</span>
            </div>
          </div>
        </div>

        {/* Card 3: Orçamentos Criados */}
        <div
          id="kpi-orcamentos-criados"
          className="bg-white border border-slate-200/50 rounded-[24px] p-6 shadow-soft hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Orçamentos Criados</span>
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-[#0B5577] shadow-xs">
              <FilePlus className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight block">
                {loading ? "—" : orcCreated}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1">no período</span>
            </div>
          </div>
        </div>

        {/* Card 4: Orçamentos Enviados p/ Faturamento */}
        <div
          id="kpi-orcamentos-faturados"
          onClick={() => navigateTo("orcamentos?status=processada")}
          className="bg-white border border-slate-200/50 rounded-[24px] p-6 shadow-soft hover:shadow-md transition-all duration-300 cursor-pointer group hover:border-orange-100"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider">Faturamento</span>
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#F2701C] shadow-xs group-hover:scale-110 transition-transform">
              <Send className="w-5 h-5 stroke-[2]" />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-black text-slate-800 tracking-tight block text-orange-600">
                {loading ? "—" : orcBilled}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-1 group-hover:text-[#F2701C] transition-colors">Ver faturados →</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. LINHA 2 — Dois blocos lado a lado */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start" id="dashboard-charts-activities">

        {/* Esquerda (maior): Gráfico Volumetria de Atendimento */}
        <div className="xl:col-span-8 bg-white border border-slate-200/50 rounded-[28px] p-8 shadow-soft flex flex-col justify-between h-[494px]" id="chart-card">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Métricas Operacionais</span>
                <h3 className="text-base font-bold text-slate-800 mt-1">Volumetria de Atendimento</h3>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="h-64 w-full mt-6 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[#0B5577] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
          <div className="h-64 w-full mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 35, right: 10, left: -25, bottom: 0 }} barCategoryGap="20%">
                <defs>
                  <pattern id="diagonalHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#EDEAE6" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#C7BFB5" strokeWidth="1.5" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EDEFF2" />
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "#9CA3AF", fontWeight: 600 }}
                  allowDecimals={false}
                  tickCount={5}
                />
                <Tooltip
                  cursor={{ fill: "#F1F5F9", opacity: 0.4 }}
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white border border-slate-100 rounded-xl shadow-lg p-3 text-slate-800 text-xs min-w-[140px] pointer-events-none">
                          <p className="font-bold text-slate-400 mb-1.5">Dia {label}</p>
                          <div className="space-y-1 font-semibold">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#0B5577]" />
                              <span className="text-slate-600">Processados:</span>
                              <span className="text-slate-900 font-bold ml-auto">{payload[0]?.value || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#FCA5A5]" />
                              <span className="text-slate-600">Erros:</span>
                              <span className="text-slate-900 font-bold ml-auto">{payload[1]?.value || 0}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="Sucesso"
                  radius={[8, 8, 0, 0]}
                  barSize={32}
                >
                  {chartData.map((entry, index) => {
                    const isHighlighted = index === maxIdx && entry.Sucesso > 0;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isHighlighted ? "#0B5577" : "url(#diagonalHatch)"}
                      />
                    );
                  })}
                </Bar>
                <Bar dataKey="Erros" fill="#FCA5A5" radius={[8, 8, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          )}

          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0B5577]"></span>
              <span>Pico de Sucesso</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C7BFB5]"></span>
              <span>Fluxo Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FCA5A5]"></span>
              <span>Erros</span>
            </div>
          </div>
        </div>

        {/* Direita (menor): Atividade Recente */}
        <div className="xl:col-span-4 bg-white border border-slate-200/50 rounded-[28px] p-6 shadow-soft flex flex-col justify-between h-[494px]" id="recent-activity-card">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Últimas Movimentações</span>
                <h3 className="text-base font-bold text-slate-800 mt-0.5">Atividade Recente</h3>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2 flex-1">
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400 font-medium text-center px-4">
                Nenhum registro encontrado para os filtros aplicados.
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0" id="recent-activity-list">
                {recentActivity.map((activity) => {
                  const isOS = activity.type === "os";

                  // status dots: verde=processado, vermelho=erro, amarelo=pendente
                  let dotColor = "bg-amber-500";
                  if (activity.status === "sucesso" || activity.status === "faturado") {
                    dotColor = "bg-emerald-500";
                  } else if (activity.status === "erro") {
                    dotColor = "bg-rose-500";
                  }

                  return (
                    <div
                      key={`${activity.type}-${activity.id}`}
                      onClick={() => navigateTo(isOS ? "ordens-servico" : "orcamentos")}
                      className="p-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Status dot */}
                        <span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} />

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-800 text-xs">
                              {activity.cod}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-200/60 text-slate-600 rounded-md text-[8px] font-black uppercase tracking-wide shrink-0">
                              {isOS ? "O.S." : "ORÇAMENTO"}
                            </span>
                          </div>

                          {/* Client placeholder (raw cliente_id until clientes table exists) */}
                          <span
                            className="text-[11px] text-slate-400 font-semibold block truncate mt-0.5"
                          >
                            {activity.cliente}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-slate-400 font-medium block">
                          {formatDate(activity.date)} {formatTime(activity.date)}
                        </span>

                        <div className="mt-0.5">
                          {activity.status === "erro" ? (
                            <span
                              className="inline-block max-w-[100px] truncate px-1.5 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded text-[8px] font-bold uppercase"
                              title={activity.detail || "Erro de processamento"}
                            >
                              {activity.detail || "Erro"}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {activity.status === "sucesso" ? "Sucesso" : activity.status === "faturado" ? "Faturado" : "Aberto"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 mt-2">
            <button
              onClick={() => navigateTo("ordens-servico")}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <span>Ver todas as Ordens</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
