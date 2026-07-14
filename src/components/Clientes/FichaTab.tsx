import React, { useState } from "react";
import { Edit3, Save, FileText } from "lucide-react";
import { GeradorAtg, FichaLevantamento } from "../../types";
import { supabase } from "../../utils/supabase";
import { toast } from "sonner";
import VincularOsWizard from "./VincularOsWizard";

interface FichaTabProps {
  gerador: GeradorAtg;
  onUpdated: (updated: GeradorAtg) => void;
}

export default function FichaTab({ gerador, onUpdated }: FichaTabProps) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [form, setForm] = useState<FichaLevantamento>(gerador.ficha_levantamento || {});
  const [saving, setSaving] = useState(false);

  if (!gerador.ficha_levantamento) {
    return (
      <div className="space-y-4">
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-amber-100">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">Este gerador ainda não tem ficha de levantamento</h3>
          <p className="text-xs text-slate-500 mt-1">Vincule a O.S. que originou o levantamento técnico para preencher esta aba.</p>
        </div>
        <VincularOsWizard gerador={gerador} onLinked={onUpdated} />
      </div>
    );
  }

  const handleFieldChange = (secao: string, campo: string, valor: string) => {
    setForm((prev) => ({
      ...prev,
      [secao]: { ...(prev[secao] || {}), [campo]: valor }
    }));
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);

    const { data, error } = await supabase
      .from("geradores_atg")
      .update({ ficha_levantamento: form })
      .eq("id", gerador.id)
      .select()
      .single();

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar ficha.", { description: error.message });
      return;
    }

    toast.success("Ficha de levantamento atualizada com sucesso!");
    setIsEditMode(false);
    onUpdated(data as GeradorAtg);
  };

  const secoes = Object.entries(form).filter(([, campos]) => campos && typeof campos === "object");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-400">
          {gerador.codigo_os_ficha_levantamento && (
            <>Vinculada via O.S. <span className="font-mono font-semibold text-slate-600">{gerador.codigo_os_ficha_levantamento}</span></>
          )}
        </p>
        {!isEditMode ? (
          <button
            onClick={() => setIsEditMode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-100 text-brand-700 rounded-lg text-xs font-bold hover:bg-brand-100 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Ficha</span>
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-bold hover:bg-brand-600 transition-colors cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? "Salvando..." : "Salvar Ficha"}</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {secoes.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">Ficha vinculada, mas sem seções preenchidas.</p>
        ) : (
          secoes.map(([secao, campos]) => (
            <div key={secao}>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-3 border-t border-slate-100 first:pt-0 first:border-0 mb-2">
                {secao.replace(/_/g, " ")}
              </h4>
              {Object.keys(campos || {}).length === 0 ? (
                <p className="text-[11px] text-slate-400 italic">Sem dados nesta seção.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(campos || {}).map(([campo, valor]) => (
                    <div key={campo}>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                        {campo.replace(/_/g, " ")}
                      </label>
                      <input
                        type="text"
                        value={valor ?? ""}
                        disabled={!isEditMode}
                        onChange={(e) => handleFieldChange(secao, campo, e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
