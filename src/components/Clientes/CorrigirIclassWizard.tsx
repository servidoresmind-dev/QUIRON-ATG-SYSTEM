import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { ClienteCard } from "../../types";
import Modal from "../ui/Modal";
import { buscarClienteIclass, BuscarClienteIclassEncontrado, CriterioBuscaIclass } from "../../utils/atgBackend";
import { supabase } from "../../utils/supabase";
import { registrarLog } from "../../utils/logEdicoes";
import { toast } from "sonner";

interface CorrigirIclassWizardProps {
  cliente: ClienteCard;
  usuario: string;
  onClose: () => void;
  onSaved: () => void;
}

const CRITERIOS: { value: CriterioBuscaIclass; label: string; placeholder: string }[] = [
  { value: "codigo", label: "Código de contrato", placeholder: "Ex: CTR000158000077" },
  { value: "nome", label: "Nome", placeholder: "Razão social ou nome fantasia" },
  { value: "cnpj", label: "CNPJ", placeholder: "Somente números" }
];

export default function CorrigirIclassWizard({ cliente, usuario, onClose, onSaved }: CorrigirIclassWizardProps) {
  const [criterio, setCriterio] = useState<CriterioBuscaIclass>("codigo");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [opcoes, setOpcoes] = useState<BuscarClienteIclassEncontrado[]>([]);
  const [selecionado, setSelecionado] = useState<BuscarClienteIclassEncontrado | null>(null);
  const [saving, setSaving] = useState(false);

  const criterioInfo = CRITERIOS.find((c) => c.value === criterio)!;

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor.trim()) {
      toast.error("Preencha o valor da busca.");
      return;
    }

    setLoading(true);
    setNaoEncontrado(false);
    setOpcoes([]);
    setSelecionado(null);

    const result = await buscarClienteIclass(criterio, valor.trim(), cliente.id);
    setLoading(false);

    if (!result.ok) {
      setNaoEncontrado(true);
      return;
    }

    if (result.encontrados.length === 1) {
      setSelecionado(result.encontrados[0]);
    } else {
      setOpcoes(result.encontrados);
    }
  };

  const handleConfirmar = async (escolha: BuscarClienteIclassEncontrado) => {
    if (!supabase) return;
    setSaving(true);

    const valorDepois = {
      iclass_id_encontrado: escolha.iclass_id,
      iclass_nome: escolha.iclass_nome,
      iclass_codigo_encontrado: escolha.iclass_codigo
    };

    const { error } = await supabase.from("omie_clientes").update(valorDepois).eq("id", cliente.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar cadastro iClass.", { description: error.message });
      return;
    }

    await registrarLog(
      "cliente",
      cliente.id,
      "corrigiu_iclass",
      usuario,
      {
        iclass_id_encontrado: cliente.iclass_id_encontrado,
        iclass_nome: cliente.iclass_nome,
        iclass_codigo_encontrado: cliente.iclass_codigo_encontrado
      },
      valorDepois
    );

    toast.success("Cadastro iClass corrigido com sucesso!");
    onSaved();
    onClose();
  };

  return (
    <Modal id="corrigir-iclass-modal" isOpen={true} onClose={onClose} title={`Corrigir cadastro iClass — ${cliente.razao_social}`}>
      <div className="space-y-4">
        <form onSubmit={handleBuscar} className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">Critério de busca</label>
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
              {CRITERIOS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    setCriterio(c.value);
                    setValor("");
                  }}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    criterio === c.value ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={criterioInfo.placeholder}
              disabled={loading}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
            >
              <Search className="w-3.5 h-3.5" />
              {loading ? "Buscando..." : "Buscar"}
            </button>
          </div>
        </form>

        {naoEncontrado && (
          <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Cliente não localizado no iClass. Tente outro método de busca ou confira se o preenchimento está
              exatamente igual ao iClass.
            </span>
          </div>
        )}

        {opcoes.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">O iClass encontrou múltiplos clientes. Selecione o correto:</p>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-64 overflow-y-auto">
              {opcoes.map((opcao) => (
                <button
                  key={opcao.iclass_id}
                  onClick={() => {
                    setSelecionado(opcao);
                    setOpcoes([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-700 truncate">{opcao.iclass_nome}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{opcao.iclass_codigo}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">{opcao.iclass_id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {selecionado && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Confira os dados abaixo antes de confirmar.</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-1.5 text-xs">
              <p><span className="text-slate-400">Nome iClass:</span> <span className="font-semibold text-slate-700">{selecionado.iclass_nome}</span></p>
              <p><span className="text-slate-400">Código do Contrato:</span> <span className="font-mono font-semibold text-slate-700">{selecionado.iclass_codigo}</span></p>
              <p><span className="text-slate-400">ID iClass:</span> <span className="font-mono font-semibold text-slate-700">{selecionado.iclass_id}</span></p>
              {selecionado.cnpj && <p><span className="text-slate-400">CNPJ:</span> <span className="font-mono font-semibold text-slate-700">{selecionado.cnpj}</span></p>}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConfirmar(selecionado)}
                disabled={saving}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Confirmar e Salvar"}
              </button>
              <button
                onClick={() => setSelecionado(null)}
                disabled={saving}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
