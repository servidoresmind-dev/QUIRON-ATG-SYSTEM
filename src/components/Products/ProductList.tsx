import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
  Edit3,
  Save,
  RotateCw
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "../../utils/supabase";
import { MOCK_PRODUTOS } from "../../data/productsServicesMock";
import { Produto } from "../../types";
import { exportToExcel } from "../../utils/excel";
import { toast } from "sonner";
import Modal from "../ui/Modal";
import { WEBHOOK_URLS, triggerWebhook } from "../../utils/webhooks";

export default function ProductList() {
  const [products, setProducts] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingPrices, setUpdatingPrices] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Edit modal state
  const [editingProduct, setEditingProduct] = useState<Produto | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editValor, setEditValor] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editCFOP, setEditCFOP] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error: dbError } = await supabase
          .from("Produtos")
          .select("*")
          .order("id", { ascending: true });

        if (dbError) throw dbError;
        setProducts(data || []);
      } else {
        // Fallback to rich mock data to keep UI functional and high-quality
        await new Promise((resolve) => setTimeout(resolve, 800));
        setProducts(MOCK_PRODUTOS);
      }
    } catch (err: any) {
      console.error("Erro ao carregar produtos:", err);
      setError(err.message || "Erro de conexão com o banco de dados");
      toast.error("Erro ao carregar produtos. Exibindo dados locais como fallback.", {
        description: err.message
      });
      // Fallback on error as well
      setProducts(MOCK_PRODUTOS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // Extract unique categories from the loaded products
  const uniqueCategories = useMemo(() => {
    const cats = products
      .map((p) => p.categora_item)
      .filter((c): c is number => c !== null && c !== undefined);
    return Array.from(new Set(cats)).sort((a, b) => Number(a) - Number(b));
  }, [products]);

  // Apply filters locally (without re-fetching)
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.nome_produto
        ? product.nome_produto.toLowerCase().includes(searchTerm.toLowerCase())
        : false;

      const matchesCategory = selectedCategory === ""
        || product.categora_item?.toString() === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;

  // Reset to page 1 if filter results change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  // Format currency with R$ or "Sob consulta" / "—"
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
    if (filteredProducts.length === 0) {
      toast.warning("Não há dados para exportar.");
      return;
    }

    // Format data for Excel
    const dataToExport = filteredProducts.map((p) => ({
      ID: p.id,
      Código: p.cod_produto,
      "Nome do Produto": p.nome_produto,
      "Valor Unitário (R$)": p.valor_unitario === 0 || p.valor_unitario === null ? "Sob consulta" : p.valor_unitario,
      Categoria: p.categora_item !== null ? p.categora_item : "Não informado",
      CFOP: p.CFOP !== null ? p.CFOP : "Não informado",
      "Criado Em": p.created_at ? new Date(p.created_at).toLocaleDateString("pt-BR") : "Não informado"
    }));

    exportToExcel(dataToExport, "Relatorio_Produtos");
    toast.success("Excel exportado com sucesso!", {
      description: `${dataToExport.length} produtos foram incluídos no relatório.`
    });
  };

  const handleUpdatePrices = async () => {
    setUpdatingPrices(true);
    try {
      await triggerWebhook(WEBHOOK_URLS.atualizarProdutos);
      toast.success("Atualização de preços disparada com sucesso!", {
        description: "O fluxo de atualização de produtos foi acionado."
      });
    } catch (err: any) {
      toast.error("Erro ao acionar a atualização de preços.", {
        description: err.message
      });
    } finally {
      setUpdatingPrices(false);
    }
  };

  const handleOpenEdit = (product: Produto) => {
    setEditingProduct(product);
    setEditNome(product.nome_produto || "");
    setEditValor(product.valor_unitario !== null ? String(product.valor_unitario) : "");
    setEditCategoria(product.categora_item !== null ? String(product.categora_item) : "");
    setEditCFOP(product.CFOP !== null ? String(product.CFOP) : "");
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    if (!isSupabaseConfigured || !supabase) {
      toast.error("Supabase não configurado.", {
        description: "Não é possível salvar alterações sem conexão com o banco de dados."
      });
      return;
    }

    setSaving(true);

    const updates = {
      nome_produto: editNome.trim() || null,
      valor_unitario: editValor.trim() === "" ? null : Number(editValor),
      categora_item: editCategoria.trim() === "" ? null : Number(editCategoria),
      CFOP: editCFOP.trim() === "" ? null : Number(editCFOP)
    };

    const { error: updateError } = await supabase
      .from("Produtos")
      .update(updates)
      .eq("id", editingProduct.id);

    setSaving(false);

    if (updateError) {
      toast.error("Erro ao salvar alterações do produto.", {
        description: updateError.message
      });
      return;
    }

    setProducts((prev) =>
      prev.map((p) => (p.id === editingProduct.id ? { ...p, ...updates } : p))
    );
    toast.success("Produto atualizado com sucesso!");
    setEditingProduct(null);
  };

  return (
    <div className="space-y-6" id="product-list-container">
      {/* Header and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Package className="w-6 h-6 text-[#0B5577]" />
            <span>Catálogo de Produtos</span>
          </h1>
          <p className="text-sm text-slate-500">
            Listagem de peças, insumos e equipamentos integrados ao faturamento
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
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B5577] text-white hover:bg-[#08435e] font-medium text-xs rounded-xl transition-all shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Card */}
      <div className="bg-white p-5 rounded-[22px] border border-slate-100 shadow-soft flex flex-col sm:flex-row items-center gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar produto por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:border-slate-200 focus:bg-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#0B5577] transition-all"
          />
        </div>

        {/* Category Dropdown */}
        <div className="w-full sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-100 focus:border-slate-200 focus:bg-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#0B5577] transition-all cursor-pointer"
          >
            <option value="">Todas as Categorias</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat.toString()}>
                Categoria {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters Helper */}
        {(searchTerm || selectedCategory) && (
          <button
            onClick={() => {
              setSearchTerm("");
              setSelectedCategory("");
            }}
            className="text-xs text-[#0B5577] hover:underline font-bold cursor-pointer whitespace-nowrap"
          >
            Limpar filtros
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
                <div key={idx} className="grid grid-cols-5 gap-4 py-3 border-b border-slate-50 animate-pulse">
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                  <div className="h-4 bg-slate-100/80 rounded col-span-2" />
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                  <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                </div>
              ))}
            </div>
          </div>
        ) : error && products.length === 0 ? (
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
              onClick={fetchProducts}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0B5577] text-white rounded-xl text-xs font-semibold hover:bg-[#08435e] transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty Filter State */
          <div className="p-16 text-center">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Nenhum produto encontrado</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
              Nenhum registro encontrado para os filtros aplicados.
            </p>
            {(searchTerm || selectedCategory) && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("");
                }}
                className="mt-4 px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Limpar filtros de busca
              </button>
            )}
          </div>
        ) : (
          /* Product Table List */
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-4 px-6 w-32">Código</th>
                  <th className="py-4 px-6">Nome do Produto</th>
                  <th className="py-4 px-6 text-right w-48">Valor Unitário</th>
                  <th className="py-4 px-6 text-center w-36">Categoria</th>
                  <th className="py-4 px-6 text-center w-36">CFOP</th>
                  <th className="py-4 px-6 text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginatedProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="hover:bg-slate-50/50 transition-colors text-xs text-slate-600 font-medium"
                  >
                    <td className="py-3.5 px-6 font-mono font-bold text-slate-500">
                      #{product.cod_produto || product.id}
                    </td>
                    <td className="py-3.5 px-6 text-slate-800 font-semibold max-w-md truncate">
                      {product.nome_produto || "—"}
                    </td>
                    <td className="py-3.5 px-6 text-right font-semibold text-slate-900">
                      {formatPrice(product.valor_unitario)}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {product.categora_item !== null && product.categora_item !== undefined ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0B5577]/10 text-[#0B5577]">
                          Cat {product.categora_item}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                          Não informado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {product.CFOP !== null && product.CFOP !== undefined ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          {product.CFOP}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                          Não informado
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => handleOpenEdit(product)}
                        className="p-1.5 text-slate-400 hover:text-[#0B5577] hover:bg-[#0B5577]/10 rounded-lg transition-all"
                        title="Editar produto"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer with Pagination Controls */}
        {!loading && filteredProducts.length > 0 && (
          <div className="px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <div>
              Exibindo <span className="font-bold text-slate-700">{paginatedProducts.length}</span> de{" "}
              <span className="font-bold text-slate-700">{filteredProducts.length}</span> produtos
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

      {/* Edit Modal */}
      {editingProduct && (
        <Modal
          id="product-edit-modal"
          isOpen={true}
          onClose={() => setEditingProduct(null)}
          title={`Editar Produto: ${editingProduct.nome_produto || editingProduct.id}`}
          footer={
            <div className="flex gap-2">
              <button
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-[#0B5577] text-white rounded-xl font-medium text-xs hover:bg-[#08435e] transition-colors shadow-soft cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? "Salvando..." : "Salvar Alterações"}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500">Nome do Produto</label>
              <input
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0B5577]"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Valor Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editValor}
                  onChange={(e) => setEditValor(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0B5577]"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Categoria</label>
                <input
                  type="number"
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0B5577]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">CFOP</label>
                <input
                  type="number"
                  value={editCFOP}
                  onChange={(e) => setEditCFOP(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0B5577]"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
