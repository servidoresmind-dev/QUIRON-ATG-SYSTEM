import React, { useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { GeradorAtg } from "../../types";
import Modal from "../ui/Modal";
import { validarCadastro } from "../../utils/atgBackend";
import { toast } from "sonner";
import PreditivaTab from "./PreditivaTab";
import FichaTab from "./FichaTab";

interface GeradorModalProps {
  gerador: GeradorAtg;
  usuario: string;
  onClose: () => void;
  onUpdated: (updated: GeradorAtg) => void;
}

export default function GeradorModal({ gerador, usuario, onClose, onUpdated }: GeradorModalProps) {
  const [tab, setTab] = useState<"preditiva" | "ficha">("preditiva");
  const [validating, setValidating] = useState(false);

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
          <FichaTab gerador={gerador} onUpdated={onUpdated} />
        )}
      </div>
    </Modal>
  );
}
