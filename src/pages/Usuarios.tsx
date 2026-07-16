/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Plus,
  ShieldAlert,
  UserCheck,
  UserX,
  Mail,
  Edit2,
  ArrowRight,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { Usuario, PerfilUsuario } from "../types";
import { navigateTo } from "../utils/navigation";
import { formatDate } from "../utils/date";
import { toast } from "sonner";
import Modal from "../components/ui/Modal";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { APP_PAGES } from "../utils/pages";

interface UsuariosProps {
  activeRole: PerfilUsuario;
}

const ROLE_LABELS: Record<PerfilUsuario, string> = {
  [PerfilUsuario.ADMIN]: "Administrador",
  [PerfilUsuario.COMUM]: "Usuário Comum"
};

export default function Usuarios({ activeRole }: UsuariosProps) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states - Create User
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>(PerfilUsuario.COMUM);
  const [formPaginas, setFormPaginas] = useState<string[]>(["dashboard"]);

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form states - Edit User
  const [editNome, setEditNome] = useState("");
  const [editPerfil, setEditPerfil] = useState<PerfilUsuario>(PerfilUsuario.COMUM);
  const [editPaginas, setEditPaginas] = useState<string[]>([]);

  const togglePagina = (
    paginas: string[],
    setPaginas: (p: string[]) => void,
    key: string
  ) => {
    setPaginas(paginas.includes(key) ? paginas.filter((p) => p !== key) : [...paginas, key]);
  };

  const invokeManageUsers = async (body: Record<string, unknown>) => {
    if (!supabase) throw new Error("Supabase não configurado.");
    const { data, error: invokeError } = await supabase.functions.invoke("manage-users", { body });
    if (invokeError) throw invokeError;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const fetchUsuarios = async () => {
    setLoading(true);
    setError(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.");
      setLoading(false);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getUser();
      setCurrentUserId(sessionData.user?.id || null);

      const data = await invokeManageUsers({ action: "list" });
      setUsuarios(data.usuarios || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar usuários.");
      toast.error("Erro ao carregar usuários.", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Check if current role has admin permission
  const isAuthorized = activeRole === PerfilUsuario.ADMIN;

  // Render Access Denied if user is not Admin
  if (!isAuthorized) {
    return (
      <div id="usuarios-access-denied" className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6 border border-rose-100 shadow-soft">
          <ShieldAlert className="w-8 h-8 stroke-[2]" />
        </div>
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">Acesso Restrito ao Administrador</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          O módulo de controle de usuários e permissões do sistema é de uso exclusivo de administradores. Seu perfil atual é <strong>{ROLE_LABELS[activeRole]}</strong>.
        </p>
        <button
          id="denied-back-to-dashboard"
          onClick={() => navigateTo("dashboard")}
          className="mt-8 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft flex items-center gap-1.5 cursor-pointer"
        >
          <span>Ir para o Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Handle Create User (sends a real Supabase Auth invite e-mail)
  const handleCreateUser = async () => {
    const newErrors: Record<string, string> = {};

    if (!formNome.trim()) newErrors.nome = "Nome é obrigatório.";
    if (!formEmail.trim()) {
      newErrors.email = "E-mail é obrigatório.";
    } else if (!/\S+@\S+\.\S+/.test(formEmail)) {
      newErrors.email = "Insira um e-mail válido.";
    }

    const emailExists = usuarios.some((u) => u.email.toLowerCase().trim() === formEmail.toLowerCase().trim());
    if (emailExists) {
      newErrors.email = "Este e-mail já está em uso.";
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      toast.error("Por favor, corrija os erros no formulário.");
      return;
    }

    setSaving(true);
    try {
      await invokeManageUsers({
        action: "invite",
        nome: formNome,
        email: formEmail,
        perfil: formPerfil,
        paginas_permitidas: formPaginas
      });
      toast.success("Convite enviado com sucesso!", {
        description: `Um e-mail foi enviado para ${formEmail} com instruções para definir a senha.`
      });
      setShowCreateModal(false);
      setFormNome("");
      setFormEmail("");
      setFormPerfil(PerfilUsuario.COMUM);
      setFormPaginas(["dashboard"]);
      fetchUsuarios();
    } catch (err: any) {
      toast.error("Erro ao convidar usuário.", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Open Edit User modal
  const handleOpenEdit = (user: Usuario) => {
    setShowEditModal(user);
    setEditNome(user.nome);
    setEditPerfil(user.perfil);
    // null = legado/administrador → começa com tudo marcado; array explícito é respeitado como está.
    setEditPaginas(user.paginas_permitidas ?? APP_PAGES.map((p) => p.key));
  };

  // Handle Save Edited User
  const handleSaveEdit = async () => {
    if (!showEditModal) return;
    if (!editNome.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      await invokeManageUsers({
        action: "updateProfile",
        id: showEditModal.id,
        nome: editNome,
        perfil: editPerfil,
        paginas_permitidas: editPaginas
      });
      toast.success(`Cadastro do usuário ${editNome} atualizado!`);
      setShowEditModal(null);
      fetchUsuarios();
    } catch (err: any) {
      toast.error("Erro ao atualizar usuário.", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // Toggle active/inactive state of user
  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      await invokeManageUsers({ action: "toggleActive", id, ativo: !currentlyActive });
      toast.success(
        currentlyActive
          ? "Usuário desativado com sucesso. Ele perderá acesso ao sistema."
          : "Usuário ativado com sucesso! Acesso restabelecido."
      );
      fetchUsuarios();
    } catch (err: any) {
      toast.error("Erro ao alterar status do usuário.", { description: err.message });
    }
  };

  return (
    <div id="usuarios-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-brand-500" />
            <span>Controle de Usuários</span>
          </h1>
          <p className="text-sm text-slate-500">
            Cadastre novos operadores e configure os perfis de acesso administrativo.
          </p>
        </div>

        <button
          id="new-user-btn"
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-sm hover:bg-brand-600 transition-colors flex items-center gap-1.5 shadow-soft cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Usuário</span>
        </button>
      </div>

      {/* Users list grid */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-soft">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(4)].map((_, idx) => (
              <div key={idx} className="grid grid-cols-5 gap-4 py-3 border-b border-slate-50 animate-pulse">
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
                <div className="h-4 bg-slate-100/80 rounded col-span-1" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Falha ao carregar usuários</h3>
            <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
            <button
              onClick={fetchUsuarios}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="usuarios-table">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                <th className="py-3 px-6">Usuário</th>
                <th className="py-3 px-6">E-mail</th>
                <th className="py-3 px-6">Perfil de Acesso</th>
                <th className="py-3 px-6">Criado Em</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
              {usuarios.map((u) => {
                const initials = u.nome
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();

                const isSelf = u.id === currentUserId;

                return (
                  <tr key={u.id} id={`user-row-${u.id}`} className="hover:bg-slate-50/30 transition-colors">
                    {/* User Profile */}
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <span className="font-bold text-slate-800 block text-sm">
                          {u.nome} {isSelf && <span className="text-[9px] bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded font-extrabold uppercase ml-1">Você</span>}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">ID: {u.id}</span>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-4 px-6 font-semibold text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{u.email}</span>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 px-6">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          u.perfil === PerfilUsuario.ADMIN
                            ? "bg-purple-50 text-purple-700 border border-purple-100"
                            : "bg-brand-50 text-brand-700 border border-brand-100"
                        }`}
                      >
                        {ROLE_LABELS[u.perfil]}
                      </span>
                      {u.perfil === PerfilUsuario.COMUM && (
                        <span className="block text-[10px] text-slate-400 font-medium mt-1">
                          {u.paginas_permitidas === null
                            ? "todas as páginas (legado)"
                            : `${u.paginas_permitidas.length} página${u.paginas_permitidas.length === 1 ? "" : "s"} liberada${u.paginas_permitidas.length === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </td>

                    {/* Created Em */}
                    <td className="py-4 px-6 text-slate-500 font-medium">{formatDate(u.criado_em)}</td>

                    {/* Status Toggle Badge */}
                    <td className="py-4 px-6">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className={`w-2 h-2 rounded-full ${u.ativo ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                        <span className={u.ativo ? "text-slate-700" : "text-slate-400"}>
                          {u.ativo ? "Ativo" : "Desativado"}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Role/Name */}
                        <button
                          id={`user-edit-${u.id}`}
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors"
                          title="Editar permissões"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Deactivate Toggle */}
                        {!isSelf && (
                          <button
                            id={`user-toggle-active-${u.id}`}
                            onClick={() => handleToggleActive(u.id, u.ativo)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              u.ativo
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            }`}
                            title={u.ativo ? "Desativar acesso" : "Reativar acesso"}
                          >
                            {u.ativo ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* MODAL: NOVO USUÁRIO */}
      {showCreateModal && (
        <Modal
          id="create-user-modal"
          isOpen={true}
          onClose={() => setShowCreateModal(false)}
          title="Convidar Novo Colaborador"
          footer={
            <div className="flex gap-2">
              <button
                id="create-user-cancel"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="create-user-save"
                onClick={handleCreateUser}
                disabled={saving}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
              >
                {saving ? "Enviando..." : "Enviar Convite"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-500 leading-snug">
                O usuário recebe um e-mail do Supabase com um link para definir a própria senha e ativar a conta.
              </p>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Nome Completo *</label>
              <input
                id="usr-create-nome"
                type="text"
                value={formNome}
                onChange={(e) => {
                  setFormNome(e.target.value);
                  if (errors.nome) setErrors((prev) => ({ ...prev, nome: "" }));
                }}
                className={`w-full px-3 py-2 text-xs border ${
                  errors.nome ? "border-rose-400" : "border-slate-200"
                } rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500`}
                placeholder="Ex: Carlos Albuquerque"
              />
              {errors.nome && <p className="text-[10px] text-rose-500 font-semibold">{errors.nome}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">E-mail Corporativo *</label>
              <input
                id="usr-create-email"
                type="email"
                value={formEmail}
                onChange={(e) => {
                  setFormEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: "" }));
                }}
                className={`w-full px-3 py-2 text-xs border ${
                  errors.email ? "border-rose-400" : "border-slate-200"
                } rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500`}
                placeholder="carlos@gestao.com.br"
              />
              {errors.email && <p className="text-[10px] text-rose-500 font-semibold">{errors.email}</p>}
            </div>

            {/* Perfil de Acesso */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Perfil de Acesso / Permissão *</label>
              <select
                id="usr-create-perfil"
                value={formPerfil}
                onChange={(e) => setFormPerfil(e.target.value as PerfilUsuario)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                <option value={PerfilUsuario.COMUM}>Usuário Comum (escolha as páginas abaixo)</option>
                <option value={PerfilUsuario.ADMIN}>Administrador (Acesso completo e controle de usuários)</option>
              </select>
            </div>

            {formPerfil === PerfilUsuario.COMUM && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Páginas Liberadas *</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  {APP_PAGES.map((page) => (
                    <label key={page.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formPaginas.includes(page.key)}
                        onChange={() => togglePagina(formPaginas, setFormPaginas, page.key)}
                        className="rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                      <span>{page.label}</span>
                    </label>
                  ))}
                </div>
                {formPaginas.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold">
                    Nenhuma página marcada — este usuário não conseguirá acessar nada do sistema.
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* MODAL: EDITAR USUÁRIO */}
      {showEditModal && (
        <Modal
          id="edit-user-modal"
          isOpen={true}
          onClose={() => setShowEditModal(null)}
          title={`Editar Permissões: ${showEditModal.nome}`}
          footer={
            <div className="flex gap-2">
              <button
                id="edit-user-cancel"
                onClick={() => setShowEditModal(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                id="edit-user-save"
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Salvar Permissões"}
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Nome do Usuário</label>
              <input
                id="usr-edit-nome"
                type="text"
                value={editNome}
                onChange={(e) => setEditNome(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-500">Perfil de Acesso</label>
              <select
                id="usr-edit-perfil"
                value={editPerfil}
                disabled={showEditModal.id === currentUserId}
                onChange={(e) => setEditPerfil(e.target.value as PerfilUsuario)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400 cursor-pointer"
              >
                <option value={PerfilUsuario.COMUM}>Usuário Comum (escolha as páginas abaixo)</option>
                <option value={PerfilUsuario.ADMIN}>Administrador (Acesso completo e controle de usuários)</option>
              </select>
              {showEditModal.id === currentUserId && (
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  Não é permitido alterar o seu próprio nível de acesso para evitar bloqueio de controle.
                </p>
              )}
            </div>

            {editPerfil === PerfilUsuario.COMUM && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500">Páginas Liberadas *</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100 rounded-xl p-3">
                  {APP_PAGES.map((page) => (
                    <label key={page.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPaginas.includes(page.key)}
                        onChange={() => togglePagina(editPaginas, setEditPaginas, page.key)}
                        className="rounded border-slate-300 text-brand-500 focus:ring-brand-500 cursor-pointer"
                      />
                      <span>{page.label}</span>
                    </label>
                  ))}
                </div>
                {editPaginas.length === 0 && (
                  <p className="text-[10px] text-amber-600 font-semibold">
                    Nenhuma página marcada — este usuário não conseguirá acessar nada do sistema.
                  </p>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
