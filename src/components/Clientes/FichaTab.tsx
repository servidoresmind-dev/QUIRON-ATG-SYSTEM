import React, { useState } from "react";
import { Edit3, Save, FileText } from "lucide-react";
import { GeradorAtg, FichaLevantamento, FichaLevantamentoOutroItem } from "../../types";
import { supabase } from "../../utils/supabase";
import { toast } from "sonner";
import { registrarLog } from "../../utils/logEdicoes";
import VincularOsWizard from "./VincularOsWizard";

interface FichaTabProps {
  gerador: GeradorAtg;
  usuario: string;
  onUpdated: (updated: GeradorAtg) => void;
}

// Um campo de seção pode ser um valor simples ("motor.modelo") ou, em seções
// como "filtros"/"mangueiras", um sub-objeto ("filtros.ar_primario" = {qtd,
// codigo, fabricante}). Só "outros" é uma lista, tratada à parte.
function isSubObjeto(valor: unknown): valor is Record<string, string> {
  return valor != null && typeof valor === "object" && !Array.isArray(valor);
}

export default function FichaTab({ gerador, usuario, onUpdated }: FichaTabProps) {
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
        <VincularOsWizard gerador={gerador} usuario={usuario} onLinked={onUpdated} />
      </div>
    );
  }

  const handleFieldChange = (secao: string, campo: string, valor: string) => {
    setForm((prev) => ({
      ...prev,
      [secao]: { ...((prev[secao] as Record<string, string>) || {}), [campo]: valor }
    }));
  };

  const handleNestedFieldChange = (secao: string, campo: string, subcampo: string, valor: string) => {
    setForm((prev) => {
      const secaoAtual = (prev[secao] as Record<string, Record<string, string>>) || {};
      const campoAtual = secaoAtual[campo] || {};
      return {
        ...prev,
        [secao]: { ...secaoAtual, [campo]: { ...campoAtual, [subcampo]: valor } }
      };
    });
  };

  const handleSave = async () => {
    if (!supabase) return;
    setSaving(true);

    const valorAntes = gerador.ficha_levantamento;

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

    await registrarLog("ficha", gerador.id, "editou_ficha", usuario, { ficha_levantamento: valorAntes }, { ficha_levantamento: form });

    toast.success("Ficha de levantamento atualizada com sucesso!");
    setIsEditMode(false);
    onUpdated(data as GeradorAtg);
  };

  const outros = Array.isArray(form.outros) ? (form.outros as FichaLevantamentoOutroItem[]) : [];
  const secoes = Object.entries(form).filter(
    ([secao, campos]) => secao !== "outros" && campos && typeof campos === "object" && !Array.isArray(campos)
  ) as [string, Record<string, unknown>][];

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
        {secoes.length === 0 && outros.length === 0 ? (
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
                  {Object.entries(campos || {}).map(([campo, valor]) =>
                    isSubObjeto(valor) ? (
                      <div key={campo} className="col-span-2 bg-slate-50/60 border border-slate-100 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                          {campo.replace(/_/g, " ")}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(valor).map(([subcampo, subvalor]) => (
                            <div key={subcampo}>
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                                {subcampo.replace(/_/g, " ")}
                              </label>
                              <input
                                type="text"
                                value={subvalor ?? ""}
                                disabled={!isEditMode}
                                onChange={(e) => handleNestedFieldChange(secao, campo, subcampo, e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-white disabled:text-slate-400"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div key={campo}>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
                          {campo.replace(/_/g, " ")}
                        </label>
                        <input
                          type="text"
                          value={(valor as string) ?? ""}
                          disabled={!isEditMode}
                          onChange={(e) => handleFieldChange(secao, campo, e.target.value)}
                          className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {outros.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider pt-3 border-t border-slate-100 mb-2">
              Informações adicionais
            </h4>
            <div className="space-y-3">
              {Object.entries(
                outros.reduce<Record<string, FichaLevantamentoOutroItem[]>>((acc, item) => {
                  const grupo = item.secao || "outros";
                  acc[grupo] = acc[grupo] || [];
                  acc[grupo].push(item);
                  return acc;
                }, {})
              ).map(([grupo, itens]) => (
                <div key={grupo} className="bg-slate-50/60 border border-slate-100 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">{grupo}</p>
                  <div className="space-y-1">
                    {itens.map((item, idx) => (
                      <p key={idx} className="text-[11px]">
                        <span className="text-slate-400">{item.pergunta}: </span>
                        <span className="font-semibold text-slate-700">{item.resposta || "—"}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
