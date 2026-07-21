import React, { useState } from "react";
import { Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { GeradorAtg, FichaLevantamento, FichaLevantamentoOutroItem } from "../../types";
import { buscarOs } from "../../utils/atgBackend";
import { supabase } from "../../utils/supabase";
import { toast } from "sonner";
import { registrarLog } from "../../utils/logEdicoes";

interface VincularOsWizardProps {
  gerador: GeradorAtg;
  usuario: string;
  onLinked: (updated: GeradorAtg) => void;
}

function isSubObjeto(valor: unknown): valor is Record<string, string> {
  return valor != null && typeof valor === "object" && !Array.isArray(valor);
}

export default function VincularOsWizard({ gerador, usuario, onLinked }: VincularOsWizardProps) {
  const [codigoOs, setCodigoOs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ checklistId: number; ficha: FichaLevantamento } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!codigoOs.trim()) {
      toast.error("Digite o código da O.S.");
      return;
    }

    if (!gerador.ativo_id) {
      toast.error("Este gerador ainda não tem um ativo_id do iClass vinculado.", {
        description: "Vincule o ativo primeiro (fluxo de adicionar gerador) antes de buscar a ficha."
      });
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    const result = await buscarOs(gerador.ativo_id, codigoOs.trim());

    setLoading(false);

    if (!result.ok) {
      setError("OS não localizada, confira o ID.");
      return;
    }

    setPreview({
      checklistId: result.checklist_pesquisa_id,
      ficha: result.ficha_levantamento as FichaLevantamento
    });
  };

  const handleConfirmar = async () => {
    if (!preview || !supabase) return;

    setConfirming(true);

    const valorDepois = {
      ficha_levantamento: preview.ficha,
      codigo_os_ficha_levantamento: codigoOs.trim(),
      checklist_pesquisa_id: preview.checklistId,
      ficha_validada_por_humano: true
    };

    const { data, error: updateError } = await supabase
      .from("geradores_atg")
      .update(valorDepois)
      .eq("id", gerador.id)
      .select()
      .single();

    setConfirming(false);

    if (updateError) {
      toast.error("Erro ao vincular ficha.", { description: updateError.message });
      return;
    }

    await registrarLog(
      "ficha",
      gerador.id,
      "vinculou_ficha",
      usuario,
      {
        ficha_levantamento: gerador.ficha_levantamento,
        codigo_os_ficha_levantamento: gerador.codigo_os_ficha_levantamento,
        checklist_pesquisa_id: gerador.checklist_pesquisa_id,
        ficha_validada_por_humano: gerador.ficha_validada_por_humano
      },
      valorDepois
    );

    toast.success("Ficha de levantamento vinculada com sucesso!");
    onLinked(data as GeradorAtg);
  };

  return (
    <div className="space-y-4">
      <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 flex items-start gap-2.5">
        <Search className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-brand-700 leading-snug">
          Digite o código da O.S. que originou o levantamento técnico deste gerador para buscar e vincular a ficha.
        </p>
      </div>

      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="text"
          value={codigoOs}
          onChange={(e) => setCodigoOs(e.target.value)}
          placeholder="Ex: OS-12345"
          disabled={loading}
          className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
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

      {preview && (
        <div className="space-y-3">
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Checklist #{preview.checklistId} encontrado. Confira os dados abaixo antes de confirmar.</span>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3 border border-slate-100 rounded-xl p-3">
            {Object.entries(preview.ficha)
              .filter(([secao]) => secao !== "outros")
              .map(([secao, campos]) => (
                <div key={secao}>
                  <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{secao.replace(/_/g, " ")}</h5>
                  {campos && Object.keys(campos).length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(campos as Record<string, unknown>).map(([campo, valor]) =>
                        isSubObjeto(valor) ? (
                          <div key={campo} className="col-span-2 bg-slate-50 rounded-lg p-2">
                            <p className="text-[10px] font-semibold text-slate-500 mb-1">{campo.replace(/_/g, " ")}</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {Object.entries(valor).map(([subcampo, subvalor]) => (
                                <div key={subcampo} className="text-[10px]">
                                  <span className="text-slate-400">{subcampo}: </span>
                                  <span className="font-semibold text-slate-700">{subvalor || "—"}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div key={campo} className="text-[11px]">
                            <span className="text-slate-400">{campo.replace(/_/g, " ")}: </span>
                            <span className="font-semibold text-slate-700">{(valor as string) || "—"}</span>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Sem dados nesta seção.</p>
                  )}
                </div>
              ))}
            {Array.isArray(preview.ficha.outros) && preview.ficha.outros.length > 0 && (
              <div>
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Informações adicionais</h5>
                <div className="space-y-1">
                  {(preview.ficha.outros as FichaLevantamentoOutroItem[]).map((item, idx) => (
                    <p key={idx} className="text-[11px]">
                      <span className="text-slate-400">{item.pergunta}: </span>
                      <span className="font-semibold text-slate-700">{item.resposta || "—"}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleConfirmar}
            disabled={confirming}
            className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
          >
            {confirming ? "Confirmando..." : "Confirmar e Vincular Ficha"}
          </button>
        </div>
      )}
    </div>
  );
}
