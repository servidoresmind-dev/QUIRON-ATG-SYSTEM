import React, { useState, useEffect } from "react";
import { AlertTriangle, RefreshCw, Save, Edit3 } from "lucide-react";
import { GeradorAtg, Preditiva, OxicatalisadorAtg } from "../../types";
import { supabase } from "../../utils/supabase";
import { salvarPreditiva } from "../../utils/atgBackend";
import { formatDate } from "../../utils/date";
import { toast } from "sonner";

interface PreditivaTabProps {
  gerador: GeradorAtg;
  usuario: string;
}

function statusBadge(status: string | null) {
  const s = (status || "").toLowerCase();
  if (s.includes("vencid")) return "bg-rose-50 text-rose-700 border-rose-100";
  if (s.includes("venc") || s.includes("atenc") || s.includes("alerta")) return "bg-amber-50 text-amber-700 border-amber-100";
  if (s.includes("ok") || s.includes("dia")) return "bg-emerald-50 text-emerald-700 border-emerald-100";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

export default function PreditivaTab({ gerador, usuario }: PreditivaTabProps) {
  const [items, setItems] = useState<Preditiva[]>([]);
  const [oxi, setOxi] = useState<OxicatalisadorAtg | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editRealizada, setEditRealizada] = useState("");
  const [editVencimento, setEditVencimento] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingOxi, setEditingOxi] = useState(false);
  const [oxiPossui, setOxiPossui] = useState<string>("");
  const [oxiBitola, setOxiBitola] = useState("");
  const [savingOxi, setSavingOxi] = useState(false);

  const fetchData = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);

    const [preditivasResult, oxiResult] = await Promise.all([
      supabase.from("vw_preditivas").select("*").eq("gerador_id", gerador.id).order("ordem", { ascending: true }),
      supabase.from("oxicatalisador_atg").select("*").eq("gerador_id", gerador.id).maybeSingle()
    ]);

    setLoading(false);

    if (preditivasResult.error) {
      setError(preditivasResult.error.message);
      return;
    }

    setItems(preditivasResult.data || []);
    setOxi(oxiResult.data || null);
    setOxiPossui(oxiResult.data?.possui === true ? "true" : oxiResult.data?.possui === false ? "false" : "");
    setOxiBitola(oxiResult.data?.bitola || "");
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gerador.id]);

  const handleOpenEdit = (item: Preditiva) => {
    setEditingId(item.id);
    setEditRealizada(item.data_realizada || "");
    setEditVencimento(item.data_vencimento || "");
  };

  const handleSave = async (item: Preditiva) => {
    setSaving(true);
    try {
      const result = await salvarPreditiva(
        item.id,
        { data_realizada: editRealizada || null, data_vencimento: editVencimento || null },
        usuario
      );
      if (!result.ok) throw new Error("O salvamento não foi confirmado pelo backend.");

      setItems((prev) =>
        prev.map((p) =>
          p.id === item.id
            ? { ...p, data_realizada: editRealizada || null, data_vencimento: editVencimento || null, editado_manual: true }
            : p
        )
      );
      toast.success(`${item.item_nome} atualizado com sucesso!`);
      setEditingId(null);
    } catch (err: any) {
      toast.error("Erro ao salvar item de preditiva.", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOxi = async () => {
    if (!supabase) return;
    setSavingOxi(true);

    const payload = {
      gerador_id: gerador.id,
      possui: oxiPossui === "" ? null : oxiPossui === "true",
      bitola: oxiBitola.trim() || null
    };

    // Faz insert ou update conforme já exista um registro — evita depender de uma
    // constraint UNIQUE em gerador_id que não temos como confirmar que existe.
    const query = oxi?.id
      ? supabase.from("oxicatalisador_atg").update(payload).eq("id", oxi.id)
      : supabase.from("oxicatalisador_atg").insert(payload);

    const { data, error: saveError } = await query.select().maybeSingle();

    setSavingOxi(false);

    if (saveError) {
      toast.error("Erro ao salvar oxicatalisador.", { description: saveError.message });
      return;
    }

    setOxi(data || payload);
    toast.success("Oxicatalisador atualizado com sucesso!");
    setEditingOxi(false);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, idx) => (
          <div key={idx} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mx-auto mb-3 border border-red-100">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-xs text-slate-500 mb-4">{error}</p>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-xs font-semibold hover:bg-brand-600 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="bg-slate-50 border border-slate-100 text-slate-500 text-[11px] rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
          <span>
            Nenhum item de preditiva encontrado para este gerador na planilha de importação. Isso costuma acontecer
            quando o equipamento ainda não foi casado (matching) com a planilha de preditivas — não é um erro do
            sistema. O item de Oxicatalisador abaixo é cadastrado separadamente e sempre aparece.
          </span>
        </div>
      )}
      <div className="overflow-x-auto border border-slate-100 rounded-xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-50/70 text-[9px] uppercase font-bold text-slate-400">
            <th className="py-2 px-3">Item</th>
            <th className="py-2 px-3">Data Realizada</th>
            <th className="py-2 px-3">Data Vencimento</th>
            <th className="py-2 px-3">Status</th>
            <th className="py-2 px-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 text-xs">
          {items.map((item) => {
            const isEditing = editingId === item.id;
            return (
              <tr key={item.id}>
                <td className="py-2 px-3 font-semibold text-slate-700">{item.item_nome}</td>
                <td className="py-1.5 px-3">
                  {isEditing ? (
                    <input
                      type="date"
                      value={editRealizada}
                      onChange={(e) => setEditRealizada(e.target.value)}
                      className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  ) : (
                    <span className="text-slate-600">{item.data_realizada ? formatDate(item.data_realizada) : "—"}</span>
                  )}
                </td>
                <td className="py-1.5 px-3">
                  {isEditing ? (
                    <input
                      type="date"
                      value={editVencimento}
                      onChange={(e) => setEditVencimento(e.target.value)}
                      className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  ) : (
                    <span className="text-slate-600">{item.data_vencimento ? formatDate(item.data_vencimento) : "—"}</span>
                  )}
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusBadge(item.status)}`}>
                    {item.status || "—"}
                  </span>
                </td>
                <td className="py-2 px-3 text-right">
                  {isEditing ? (
                    <button
                      onClick={() => handleSave(item)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-500 text-white rounded-lg text-[10px] font-bold hover:bg-brand-600 cursor-pointer disabled:opacity-60"
                    >
                      <Save className="w-3 h-3" />
                      {saving ? "Salvando..." : "Salvar"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Oxicatalisador — linha especial, sem datas */}
          <tr className="bg-slate-50/40">
            <td className="py-2 px-3 font-semibold text-slate-700">Oxicatalisador</td>
            <td className="py-1.5 px-3 text-slate-400" colSpan={2}>
              {editingOxi ? (
                <div className="flex items-center gap-2">
                  <select
                    value={oxiPossui}
                    onChange={(e) => setOxiPossui(e.target.value)}
                    className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="">Possui?</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Bitola"
                    value={oxiBitola}
                    onChange={(e) => setOxiBitola(e.target.value)}
                    className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 w-28"
                  />
                </div>
              ) : (
                <span>
                  {oxi?.possui === true ? "Possui" : oxi?.possui === false ? "Não possui" : "Não informado"}
                  {oxi?.bitola ? ` · Bitola: ${oxi.bitola}` : ""}
                </span>
              )}
            </td>
            <td className="py-2 px-3">—</td>
            <td className="py-2 px-3 text-right">
              {editingOxi ? (
                <button
                  onClick={handleSaveOxi}
                  disabled={savingOxi}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-brand-500 text-white rounded-lg text-[10px] font-bold hover:bg-brand-600 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-3 h-3" />
                  {savingOxi ? "Salvando..." : "Salvar"}
                </button>
              ) : (
                <button
                  onClick={() => setEditingOxi(true)}
                  className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-all cursor-pointer"
                  title="Editar"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>
  );
}
