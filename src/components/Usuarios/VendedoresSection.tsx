/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Briefcase, Plus, Edit2, UserCheck, UserX, RefreshCw, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Vendedor } from "../../types";
import { supabase, isSupabaseConfigured } from "../../utils/supabase";
import { registrarLog } from "../../utils/logEdicoes";
import Modal from "../ui/Modal";

// Gestão do cadastro de vendedores (tabela `vendedores`), exibida na tela de
// Controle de Usuários (só Administrador). Desativar um vendedor só o tira da
// lista de atribuição de clientes — o login dele (se houver) é controlado à
// parte, na tabela de usuários acima.
export default function VendedoresSection() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [clientesPorVendedor, setClientesPorVendedor] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usuarioEmail, setUsuarioEmail] = useState("desconhecido");

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Vendedor | null>(null);
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchVendedores = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado.");
      setLoading(false);
      return;
    }

    const { data, error: fetchError } = await supabase
      .from("vendedores")
      .select("*")
      .order("ativo", { ascending: false })
      .order("nome", { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      setLoading(false);
      return;
    }
    setVendedores(data || []);

    // Quantos clientes cada vendedor já tem. Só informativo — se falhar, a
    // tabela continua funcionando sem a contagem.
    const { data: atribuidos, error: countError } = await supabase
      .from("omie_clientes")
      .select("vendedor_id")
      .not("vendedor_id", "is", null);

    if (countError) {
      console.warn("Não foi possível contar os clientes por vendedor.", countError.message);
      setClientesPorVendedor({});
    } else {
      const contagem: Record<number, number> = {};
      (atribuidos || []).forEach((c: { vendedor_id: number }) => {
        contagem[c.vendedor_id] = (contagem[c.vendedor_id] || 0) + 1;
      });
      setClientesPorVendedor(contagem);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchVendedores();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUsuarioEmail(data.user.email);
    });
  }, []);

  const openCreate = () => {
    setFormNome("");
    setFormEmail("");
    setErrors({});
    setShowCreate(true);
  };

  const openEdit = (v: Vendedor) => {
    setFormNome(v.nome);
    setFormEmail(v.email || "");
    setErrors({});
    setEditing(v);
  };

  const closeModals = () => {
    setShowCreate(false);
    setEditing(null);
  };

  const validate = (): { nome: string; email: string | null } | null => {
    const nome = formNome.trim();
    const email = formEmail.trim();
    const newErrors: Record<string, string> = {};

    if (!nome) newErrors.nome = "Nome é obrigatório.";
    if (email && !/\S+@\S+\.\S+/.test(email)) newErrors.email = "Insira um e-mail válido.";

    const emailEmUso = vendedores.some(
      (v) => v.id !== editing?.id && !!email && (v.email || "").toLowerCase() === email.toLowerCase()
    );
    if (emailEmUso) newErrors.email = "Este e-mail já está em uso por outro vendedor.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      toast.error("Por favor, corrija os erros no formulário.");
      return null;
    }
    return { nome, email: email || null };
  };

  const handleCreate = async () => {
    const valores = validate();
    if (!valores || !supabase) return;

    setSaving(true);
    const { data, error: insertError } = await supabase
      .from("vendedores")
      .insert({ nome: valores.nome, email: valores.email })
      .select()
      .single();
    setSaving(false);

    if (insertError) {
      toast.error("Erro ao cadastrar vendedor.", {
        description: insertError.code === "23505" ? "Este e-mail já está em uso por outro vendedor." : insertError.message
      });
      return;
    }

    await registrarLog("vendedor", data.id, "criou_vendedor", usuarioEmail, null, {
      nome: valores.nome,
      email: valores.email
    });
    toast.success(`Vendedor ${valores.nome} cadastrado!`);
    closeModals();
    fetchVendedores();
  };

  const handleSaveEdit = async () => {
    const valores = validate();
    if (!valores || !editing || !supabase) return;

    // Só grava (e registra no histórico) o que de fato mudou — mesmo padrão do
    // restante do sistema, e é o que permite o "Reverter" do Histórico.
    const antes: Record<string, unknown> = {};
    const depois: Record<string, unknown> = {};
    if (valores.nome !== editing.nome) {
      antes.nome = editing.nome;
      depois.nome = valores.nome;
    }
    if (valores.email !== editing.email) {
      antes.email = editing.email;
      depois.email = valores.email;
    }

    if (Object.keys(depois).length === 0) {
      closeModals();
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.from("vendedores").update(depois).eq("id", editing.id);
    setSaving(false);

    if (updateError) {
      toast.error("Erro ao atualizar vendedor.", {
        description: updateError.code === "23505" ? "Este e-mail já está em uso por outro vendedor." : updateError.message
      });
      return;
    }

    await registrarLog("vendedor", editing.id, "editou_vendedor", usuarioEmail, antes, depois);
    toast.success(`Vendedor ${valores.nome} atualizado!`);
    closeModals();
    fetchVendedores();
  };

  const handleToggleAtivo = async (v: Vendedor) => {
    if (!supabase) return;
    setTogglingId(v.id);

    const { error: updateError } = await supabase.from("vendedores").update({ ativo: !v.ativo }).eq("id", v.id);
    setTogglingId(null);

    if (updateError) {
      toast.error("Erro ao alterar status do vendedor.", { description: updateError.message });
      return;
    }

    await registrarLog(
      "vendedor",
      v.id,
      v.ativo ? "desativou_vendedor" : "ativou_vendedor",
      usuarioEmail,
      { ativo: v.ativo },
      { ativo: !v.ativo }
    );
    toast.success(
      v.ativo
        ? `${v.nome} não aparece mais na lista de atribuição de clientes.`
        : `${v.nome} voltou para a lista de atribuição de clientes.`
    );
    setVendedores((prev) => prev.map((x) => (x.id === v.id ? { ...x, ativo: !v.ativo } : x)));
  };

  const totalAtivos = vendedores.filter((v) => v.ativo).length;
  const isModalOpen = showCreate || editing !== null;

  return (
    <div id="vendedores-section" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand-500" />
            <span>Vendedores</span>
          </h2>
          <p className="text-xs text-slate-500">
            Quem aparece na lista de atribuição de clientes. Desativar um vendedor só o tira dessa lista — o login dele,
            se existir, é controlado na tabela de usuários acima.
          </p>
        </div>
        <button
          id="new-vendedor-btn"
          onClick={openCreate}
          className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-sm hover:bg-brand-600 transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Vendedor</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-soft">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="h-8 bg-slate-100/80 rounded animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Falha ao carregar vendedores</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
            <button
              onClick={fetchVendedores}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" id="vendedores-table">
              <thead>
                <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  <th className="py-3 px-6">Vendedor</th>
                  <th className="py-3 px-6">E-mail</th>
                  <th className="py-3 px-6">Origem</th>
                  <th className="py-3 px-6">Login</th>
                  <th className="py-3 px-6">Clientes</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {vendedores.map((v) => (
                  <tr
                    key={v.id}
                    id={`vendedor-row-${v.id}`}
                    className={`hover:bg-slate-50/30 transition-colors ${v.ativo ? "" : "opacity-60"}`}
                  >
                    <td className="py-3 px-6 font-bold text-slate-800 text-sm">{v.nome}</td>
                    <td className="py-3 px-6 text-slate-600">{v.email || <span className="text-slate-300">—</span>}</td>
                    <td className="py-3 px-6">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200">
                        {v.omie_vendedor_id !== null ? "Omie" : "Manual"}
                      </span>
                    </td>
                    <td className="py-3 px-6">
                      {v.auth_user_id ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <Link2 className="w-3.5 h-3.5" />
                          Vinculado
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-6 font-semibold text-slate-700">{clientesPorVendedor[v.id] || 0}</td>
                    <td className="py-3 px-6">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className={`w-2 h-2 rounded-full ${v.ativo ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                        <span className={v.ativo ? "text-slate-700" : "text-slate-400"}>
                          {v.ativo ? "Ativo" : "Desativado"}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          id={`vendedor-edit-${v.id}`}
                          onClick={() => openEdit(v)}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar vendedor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          id={`vendedor-toggle-${v.id}`}
                          onClick={() => handleToggleAtivo(v)}
                          disabled={togglingId === v.id}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                            v.ativo
                              ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={v.ativo ? "Desativar vendedor" : "Reativar vendedor"}
                        >
                          {v.ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {vendedores.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 px-6 text-center text-slate-400">
                      Nenhum vendedor cadastrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="px-6 py-3 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
              {totalAtivos} ativo{totalAtivos === 1 ? "" : "s"} de {vendedores.length}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <Modal
          id="vendedor-modal"
          isOpen={true}
          onClose={closeModals}
          title={editing ? `Editar Vendedor: ${editing.nome}` : "Novo Vendedor"}
          footer={
            <div className="flex gap-2">
              <button
                id="vendedor-cancel"
                onClick={closeModals}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="vendedor-save"
                onClick={editing ? handleSaveEdit : handleCreate}
                disabled={saving}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
              >
                {saving ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Nome *</label>
              <input
                id="vendedor-nome"
                type="text"
                value={formNome}
                onChange={(e) => {
                  setFormNome(e.target.value);
                  if (errors.nome) setErrors((prev) => ({ ...prev, nome: "" }));
                }}
                className={`w-full px-3 py-2 text-xs border ${
                  errors.nome ? "border-rose-400" : "border-slate-200"
                } rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500`}
                placeholder="Ex: Solange"
              />
              {errors.nome && <p className="text-[10px] text-rose-500 font-semibold">{errors.nome}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">E-mail</label>
              <input
                id="vendedor-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
                className={`w-full px-3 py-2 text-xs border ${
                  errors.email ? "border-rose-400" : "border-slate-200"
                } rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500`}
                placeholder="solange@atggeradores.com.br"
              />
              {errors.email && <p className="text-[10px] text-rose-500 font-semibold">{errors.email}</p>}
              <p className="text-[10px] text-slate-400">
                Opcional. Para o vendedor entrar no sistema, o acesso é criado na tabela de usuários (perfil Vendedor).
              </p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
