/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../utils/supabase";
import quironLogoBall from "../assets/logo_boll.svg";

interface DefinirSenhaInicialProps {
  email: string;
  onConcluido: () => void;
}

// Tela mostrada quando o usuário chega pelo link de convite/recuperação do
// Supabase: esse link já autentica sozinho (sem pedir senha nenhuma), então
// sem esta tela a pessoa ficava "logada" sem nunca ter definido uma senha —
// e sem como entrar de novo depois. Usa `updateUser`, que funciona com a
// própria sessão do usuário (não precisa da service_role).
export default function DefinirSenhaInicial({ email, onConcluido }: DefinirSenhaInicialProps) {
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd1.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (pwd1.length > 72) {
      toast.error("A senha deve ter no máximo 72 caracteres.");
      return;
    }
    if (pwd1 !== pwd2) {
      toast.error("As duas senhas não são iguais.");
      return;
    }
    if (!supabase) return;

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pwd1 });
    setSaving(false);

    if (error) {
      toast.error("Erro ao definir senha.", { description: error.message });
      return;
    }

    toast.success("Senha definida com sucesso!", { description: "Você já pode usar o sistema normalmente." });
    onConcluido();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" id="definir-senha-inicial-page">
      <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl shadow-soft p-8 space-y-6">
        <div className="flex flex-col items-center text-center gap-2">
          <img src={quironLogoBall} alt="Quiron" className="h-14 w-auto mb-2" />
          <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Bem-vindo(a)!</h1>
          <p className="text-sm text-slate-500">
            Sua conta <strong className="text-slate-700">{email}</strong> foi criada. Antes de continuar, defina a
            senha que você vai usar para entrar no sistema a partir de agora.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Nova senha (8 a 72 caracteres)
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                id="def-senha-pwd1"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={pwd1}
                onChange={(e) => setPwd1(e.target.value)}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#0B5577] focus:bg-white"
                disabled={saving}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded"
                disabled={saving}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Repita a senha</label>
            <input
              id="def-senha-pwd2"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              className="w-full px-3.5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-[#0B5577] focus:bg-white"
              disabled={saving}
            />
            {pwd2 !== "" && pwd1 !== pwd2 && (
              <p className="text-xs text-red-500 font-semibold">As duas senhas não são iguais.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#0B5577] text-white hover:bg-[#08435e] font-semibold text-sm rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-75"
          >
            {saving ? "Salvando..." : "Definir senha e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
