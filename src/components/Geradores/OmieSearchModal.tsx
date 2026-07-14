import React, { useState } from "react";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "../ui/Modal";
import { OmieCliente } from "../../types";
import { supabase, isSupabaseConfigured } from "../../utils/supabase";
import { toast } from "sonner";

interface OmieSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (cliente: OmieCliente) => void;
}

export default function OmieSearchModal({ isOpen, onClose, onSelect }: OmieSearchModalProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<OmieCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!term.trim()) {
      toast.error("Digite um nome ou CNPJ para buscar.");
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado.");
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    // Strip characters that have special meaning in PostgREST's or() filter syntax
    const cleanTerm = term.trim().replace(/[,()]/g, "");
    const { data, error: searchError } = await supabase
      .from("omie")
      .select("nome, cnpj, cod_omie")
      .or(`nome.ilike.%${cleanTerm}%,cnpj.ilike.%${cleanTerm}%`)
      .limit(30);

    setLoading(false);

    if (searchError) {
      setError(searchError.message);
      return;
    }

    setResults(data || []);
  };

  const handleClose = () => {
    setTerm("");
    setResults([]);
    setError(null);
    setSearched(false);
    onClose();
  };

  return (
    <Modal
      id="omie-search-modal"
      isOpen={isOpen}
      onClose={handleClose}
      title="Buscar Código do Cliente no Omie"
    >
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              autoFocus
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 focus:border-slate-200 focus:bg-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2.5 bg-brand-500 text-white rounded-xl font-semibold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!error && searched && !loading && results.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-6">
            Nenhum cliente encontrado no Omie para este termo.
          </p>
        )}

        {results.length > 0 && (
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
            {results.map((cliente, idx) => (
              <button
                key={`${cliente.cod_omie}-${idx}`}
                type="button"
                onClick={() => {
                  onSelect(cliente);
                  handleClose();
                }}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{cliente.nome}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{cliente.cnpj}</p>
                </div>
                <span className="shrink-0 flex items-center gap-1 bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-1 rounded-lg">
                  <CheckCircle2 className="w-3 h-3" />
                  {cliente.cod_omie}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
