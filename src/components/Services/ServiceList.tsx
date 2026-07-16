import React, { useState, useEffect, useMemo } from "react";
import {
  Wrench,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  RotateCw,
  Ban,
  CheckCircle2
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../utils/supabase";
import { MOCK_SERVICOS } from "../../data/productsServicesMock";
import { Servico, PerfilUsuario } from "../../types";
import { exportToExcel } from "../../utils/excel";
import { toast } from "sonner";
import { WEBHOOK_URLS, triggerWebhook } from "../../utils/webhooks";

interface ServiceListProps {
  activeRole: PerfilUsuario;
}

export default function ServiceList({ activeRole }: ServiceListProps) {
  const [services, setServices] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPrices, setUpdatingPrices] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const fetchServices = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: dbError } = await supabase
          .from("Serviços")
          .select("*")
          .order("id", { ascending: true });
        
        if (dbError) throw dbError;
        setServices(data || []);
      } else {
        // Fallback to rich mock data to keep UI functional and high-quality
        await new Promise((resolve) => setTimeout(resolve, 800));
        setServices(MOCK_SERVICOS);
      }
    } catch (err: any) {
      console.error("Erro ao carregar serviços:", err);
      setError(err.message || "Erro de conexão com o banco de dados");
      toast.error("Erro ao carregar serviços. Exibindo dados locais como fallback.", {
        description: err.message
      });
      // Fallback on error
      setServices(MOCK_SERVICOS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Apply search locally
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      return service.cDescricao
        ? service.cDescricao.toLowerCase().includes(searchTerm.toLowerCase())
        : false;
    });
  }, [services, searchTerm]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage) || 1;
  
  // Reset page on search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredServices.slice(start, start + itemsPerPage);
  }, [filteredServices, currentPage]);

  // Format currency with R$ or "Sob consulta"
  const formatPrice = (value: number | null) => {
    if (value === 0 || value === null || value === undefined) {
      return (
        <span className="text-amber-600 font-bold italic text-xs bg-amber-50 px-2 py-1 rounded-lg">
          Sob consulta
        </span>
      );
    }
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleExport = () => {
    if (filteredServices.length === 0) {
      toast.warning("Não há dados para exportar.");
      return;
    }

    // Format data for Excel
    const dataToExport = filteredServices.map((s) => ({
      ID: s.id,
      "Código do Serviço": s.nCodServ,
      Descrição: s.cDescricao,
      "Valor (R$)": s.nValorDesc === 0 ? "Sob consulta" : s.nValorDesc,
      "Criado Em": s.created_at ? new Date(s.created_at).toLocaleDateString("pt-BR") : "Não informado"
    }));

    exportToExcel(dataToExport, "Relatorio_Servicos");
    toast.success("Excel exportado com sucesso!", {
      description: `${dataToExport.length} serviços foram incluídos no relatório.`
    });
  };

  const handleToggleAtivo = async (service: Servico) => {
    if (!isSupabaseConfigured || !supabase) return;

    const { error: updateError } = await supabase
      .from("Serviços")
      .update({ inativo: !service.inativo })
      .eq("id", service.id);

    if (updateError) {
      toast.error("Erro ao alterar status do serviço.", { description: updateError.message });
      return;
    }

    setServices((prev) => prev.map((s) => (s.id === service.id ? { ...s, inativo: !s.inativo } : s)));
    toast.success(
      service.inativo
        ? `${service.cDescricao || "Serviço"} reativado com sucesso!`
        : `${service.cDescricao || "Serviço"} inativado com sucesso!`
    );
  };

  const handleUpdatePrices = async () => {
    setUpdatingPrices(true);
    try {
      await triggerWebhook(WEBHOOK_URLS.atualizarServicos);
      toast.success("Atualização de preços disparada com sucesso!", {
        description: "O fluxo de atualização de serviços foi acionado."
      });
    } catch (err: any) {
      toast.error("Erro ao acionar a atualização de preços.", {
        description: err.message
      });
    } finally {
      setUpdatingPrices(false);
    }
  };

  return (
    <div className="space-y-6" id="service-list-container">
      {/* Header and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#F2701C]" />
            <span>Catálogo de Serviços</span>
          </h1>
          <p className="text-sm text-slate-500">
            Listagem de serviços técnicos, preventivas e vistorias comerciais
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Supabase status indicator */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${
            isSupabaseConfigured 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSupabaseConfigured ? "bg-emerald-500" : "bg-slate-400"}`} />
            {isSupabaseConfigured ? "Supabase Conectado" : "Ambiente Local"}
          </span>

          <button
            onClick={handleUpdatePrices}
            disabled={updatingPrices}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium text-xs rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-60"
          >
            <RotateCw className={`w-4 h-4 ${updatingPrices ? "animate-spin" : ""}`} />
            <span>{updatingPrices ? "Atualizando..." : "Atualizar Preços"}</span>
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2701C] text-white hover:bg-[#D4600F] font-medium text-xs rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white p-5 rounded-[22px] border border-slate-100 shadow-soft flex flex-col sm:flex-row items-center gap-4">
        {/* Search Input */}
        <div className="relative w-full flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar serviço por descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:border-slate-200 focus:bg-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#F2701C] transition-all"
          />
        </div>

        {/* Clear Filters Helper */}
        {searchTerm && (
          <button
            onClick={() => setSearchTerm("")}
            className="text-xs text-[#F2701C] hover:underline font-bold cursor-pointer whitespace-nowrap"
          >
            Limpar busca
          </button>
        )}
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-[22px] border border-slate-100 shadow-soft overflow-hidden">
        {loading ? (
          /* Loading Skeletons */
          <div className="p-6 space-y-4">
            <div className="h-10 bg-slate-50 rounded-xl animate-pulse" />
            <div className="space-y-3">
              {[...Array(6)].map((_, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-4 py-3 border-b border-slate-50 animate-pulse">
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                </div>
              ))}
            </div>
          </div>
        ) : error && services.length === 0 ? (
          /* Error Retry Screen */
          <div className="p-12 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Falha ao conectar com o Supabase</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">
              {error}. Por favor, verifique suas credenciais de ambiente ou tente novamente.
            </p>
            <button
              onClick={fetchServices}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F2701C] text-white rounded-xl text-xs font-semibold hover:bg-[#D4600F] transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : filteredServices.length === 0 ? (
          /* Empty Filter State */
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Wrench className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum serviço encontrado</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Nenhum serviço encontrado para o termo buscado. Tente alterar sua pesquisa.
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="mt-4 px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Limpar filtros de busca
              </button>
            )}
          </div>
        ) : (
          /* Service Table List */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-44">Código do Serviço</th>
                  <th className="py-4 px-6">Descrição</th>
                  <th className="py-4 px-6 text-right w-48">Valor</th>
                  <th className="py-4 px-6 text-center w-28">Status</th>
                  {activeRole === PerfilUsuario.ADMIN && <th className="py-4 px-6 text-right w-20">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedServices.map((service) => (
                  <tr
                    key={service.id}
                    className="hover:bg-slate-50/50 transition-colors text-xs text-slate-600 font-medium"
                  >
                    <td className="py-4 px-6 font-mono font-bold text-[#F2701C]">
                      COD-{service.nCodServ}
                    </td>
                    <td className="py-4 px-6 text-slate-800 font-semibold max-w-lg">
                      {service.cDescricao}
                    </td>
                    <td className="py-4 px-6 text-right font-semibold text-slate-900">
                      {formatPrice(service.nValorDesc)}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          service.inativo ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${service.inativo ? "bg-slate-400" : "bg-emerald-500"}`} />
                        {service.inativo ? "Inativo" : "Ativo"}
                      </span>
                    </td>
                    {activeRole === PerfilUsuario.ADMIN && (
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleToggleAtivo(service)}
                          className={`p-1.5 rounded-lg transition-all ${
                            service.inativo
                              ? "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                              : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          }`}
                          title={service.inativo ? "Reativar serviço" : "Inativar serviço"}
                        >
                          {service.inativo ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Pagination Controls */}
        {!loading && filteredServices.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <div>
              Exibindo <span className="font-bold text-slate-700">{paginatedServices.length}</span> de{" "}
              <span className="font-bold text-slate-700">{filteredServices.length}</span> serviços
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="px-3 py-1 font-bold bg-white border border-slate-200 rounded-lg text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
