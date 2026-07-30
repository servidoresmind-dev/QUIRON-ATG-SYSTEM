import React, { useState } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";
import { GeradorAtg } from "../../types";
import Modal from "../ui/Modal";
import { validarCadastro } from "../../utils/atgBackend";
import { supabase } from "../../utils/supabase";
import { registrarLog } from "../../utils/logEdicoes";
import { toast } from "sonner";
import PreditivaTab from "./PreditivaTab";
import FichaTab from "./FichaTab";

interface GeradorModalProps {
  gerador: GeradorAtg;
  usuario: string;
  onClose: () => void;
  onUpdated: (updated: GeradorAtg) => void;
  onDeleted: (geradorId: number) => void;
}

export default function GeradorModal({ gerador, usuario, onClose, onUpdated, onDeleted }: GeradorModalProps) {
  const [tab, setTab] = useState<"preditiva" | "ficha">("preditiva");
  const [validating, setValidating] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleValidar = async () => {
    setValidating(true);
    try {
      const result = await validarCadastro("gerador", gerador.id, usuario, !gerador.validado);
      if (!result.ok) throw new Error("A validação não foi confirmada pelo backend.");

      onUpdated({ ...gerador, validado: !gerador.validado });
      toast.success(!gerador.validado ? "Gerador marcado como validado." : "Validação do gerador desfeita.");
    } catch (err: any) {
      toast.error("Erro ao validar gerador.", { description: err.message });
    } finally {
      setValidating(false);
    }
  };

  const handleExcluir = async () => {
    if (!supabase) return;
    setExcluindo(true);

    // Exclusão real e definitiva — sem possibilidade de recuperação pela UI.
    // O log guarda uma cópia completa do gerador (valor_antes) só para
    // auditoria/consulta; não existe "Reverter" para esta ação (ver Historico.tsx).
    const { error } = await supabase.from("geradores_atg").delete().eq("id", gerador.id);

    setExcluindo(false);

    if (error) {
      toast.error("Erro ao excluir gerador.", { description: error.message });
      return;
    }

    await registrarLog("gerador", gerador.id, "excluiu_definitivamente", usuario, { ...gerador }, null);

    toast.success("Gerador excluído definitivamente.");
    onDeleted(gerador.id);
    onClose();
  };

  return (
    <Modal
      id="gerador-atg-modal"
      isOpen={true}
      onClose={onClose}
      title={gerador.descricao || "Detalhe do Gerador"}
      size="xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
            {gerador.fabricante} {gerador.modelo} · Série {gerador.num_serie || "—"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-medium text-xs hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Cabeçalho do ativo — somente leitura */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Fabricante</span>
            <p className="text-xs font-bold text-slate-700 mt-0.5">{gerador.fabricante || "—"}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Modelo</span>
            <p className="text-xs font-bold text-slate-700 mt-0.5">{gerador.modelo || "—"}</p>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[9px] font-bold text-slate-400 uppercase block">Nº de Série</span>
            <p className="text-xs font-bold text-slate-700 mt-0.5">{gerador.num_serie || "—"}</p>
          </div>
          <div className="bg-brand-50 p-3 rounded-xl border border-brand-100">
            <span className="text-[9px] font-bold text-brand-500 uppercase block">ID iClass (não editável)</span>
            <p className="text-xs font-bold text-brand-700 mt-0.5 font-mono">{gerador.ativo_id ?? "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleValidar}
            disabled={validating}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer disabled:opacity-60 ${
              gerador.validado
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                : "bg-brand-500 text-white hover:bg-brand-600"
            }`}
          >
            {gerador.validado ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
            <span>{gerador.validado ? "Validado (clique para reabrir)" : "Conferido"}</span>
          </button>

          <button
            onClick={() => setConfirmandoRemocao(true)}
            className="px-3.5 py-2 bg-white border border-slate-200 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-50 transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Gerador</span>
          </button>
        </div>

        {confirmandoRemocao && (
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-rose-800">
              Tem certeza? O gerador será apagado definitivamente do banco de dados, sem possibilidade de recuperação.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExcluir}
                disabled={excluindo}
                className="px-3.5 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
              >
                {excluindo ? "Excluindo..." : "Sim, excluir definitivamente"}
              </button>
              <button
                onClick={() => setConfirmandoRemocao(false)}
                disabled={excluindo}
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit border border-slate-200">
          <button
            onClick={() => setTab("preditiva")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === "preditiva" ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Preditiva
          </button>
          <button
            onClick={() => setTab("ficha")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === "ficha" ? "bg-white text-brand-700 shadow-sm" : "text-slate-400 hover:text-slate-700"
            }`}
          >
            Ficha de Levantamento
          </button>
        </div>

        {tab === "preditiva" ? (
          <PreditivaTab gerador={gerador} usuario={usuario} />
        ) : (
          <FichaTab gerador={gerador} usuario={usuario} onUpdated={onUpdated} />
        )}
      </div>
    </Modal>
  );
}
