/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield, AlertCircle } from "lucide-react";
import { navigateTo } from "../utils/navigation";
import { toast } from "sonner";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import quironLogoWhite from "../assets/quiron_logo_white.svg";
import quironLogoBall from "../assets/logo_boll.svg";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateEmail = (val: string) => {
    if (!val) return "Campo obrigatório";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val)) {
      return "E-mail inválido";
    }
    return "";
  };

  const handleBlurEmail = () => {
    const err = validateEmail(email);
    setErrors((prev) => ({ ...prev, email: err }));
  };

  const handleBlurPassword = () => {
    setErrors((prev) => ({
      ...prev,
      password: !password ? "Campo obrigatório" : ""
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailErr = validateEmail(email);
    const passErr = !password ? "Campo obrigatório" : "";

    if (emailErr || passErr) {
      setErrors({ email: emailErr, password: passErr });
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      toast.error("Supabase não configurado.", {
        description: "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para habilitar o login."
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    setLoading(false);

    if (error) {
      toast.error("E-mail ou senha incorretos.", {
        description: "Verifique suas credenciais de acesso."
      });
      return;
    }

    toast.success("Login realizado com sucesso!", {
      description: "Bem-vindo de volta."
    });
    navigateTo("dashboard");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex" id="login-page">
      {/* LEFT PANEL - Beautiful Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0B5577] relative overflow-hidden flex-col justify-between p-12 text-white">
        {/* Subtle background glow & geometric art */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(242,112,28,0.15),transparent)] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-[#F2701C]/10 blur-3xl" />
        <div className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl animate-pulse" />

        {/* Header Branding */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={quironLogoWhite} alt="Quiron" className="h-14 w-auto" />
          <span className="w-px h-4 bg-white/30" />
          <span className="text-[14px] font-semibold tracking-wide text-slate-200 leading-tight">
            QUIRON ATG SYSTEM
          </span>
        </div>

        {/* Hero Copy */}
        <div className="relative z-10 max-w-md my-auto">
          <span className="text-[10px] bg-white/15 px-2.5 py-1 rounded-full text-white font-extrabold uppercase tracking-wider border border-white/10 mb-4 inline-block">
            Portal Operador v2.0
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight mt-2 text-white">
            Gestão de orçamentos e orde de serviços
          </h1>
          <p className="text-slate-200 text-sm mt-4 leading-relaxed">
            Monitore ordens de serviço, faça a conciliação de faturamentos de manutenção e gerencie orçamentos com a mais alta precisão e segurança.
          </p>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-slate-300 font-medium flex items-center justify-between">
          <span>© 2026 ATG Geradores</span>
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Conexão Segura SSL</span>
          </span>
        </div>
      </div>

      {/* RIGHT PANEL - Clean Sign-in Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md space-y-8">
          {/* Logo on small screens */}
          <div className="lg:hidden flex flex-col items-center mb-6">
            <img src={quironLogoBall} alt="Quiron" className="h-16 w-auto mb-2" />
            <h2 className="text-lg font-bold text-slate-800">ATG GERADORES</h2>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              Acesse sua conta
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Insira suas credenciais corporativas abaixo para entrar no sistema.
            </p>
          </div>

          {!isSupabaseConfigured && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Supabase não configurado. Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para habilitar o login.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* E-mail Address Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                Endereço de E-mail
              </label>
              <div className="relative">
                <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                  errors.email ? "text-red-400" : "text-slate-400"
                }`} />
                <input
                  type="email"
                  placeholder="exemplo@sistema.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) {
                      setErrors((prev) => ({ ...prev, email: "" }));
                    }
                  }}
                  onBlur={handleBlurEmail}
                  className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:bg-white ${
                    errors.email
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-100 focus:border-slate-300 focus:ring-[#0B5577]"
                  }`}
                  disabled={loading}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Senha de Acesso
                </label>
              </div>
              <div className="relative">
                <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${
                  errors.password ? "text-red-400" : "text-slate-400"
                }`} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors((prev) => ({ ...prev, password: "" }));
                    }
                  }}
                  onBlur={handleBlurPassword}
                  className={`w-full pl-10 pr-12 py-3 bg-slate-50 border rounded-xl text-sm transition-all focus:outline-none focus:ring-1 focus:bg-white ${
                    errors.password
                      ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "border-slate-100 focus:border-slate-300 focus:ring-[#0B5577]"
                  }`}
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-500 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{errors.password}</span>
                </p>
              )}
            </div>

            {/* Submit Button with Loading State */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#0B5577] text-white hover:bg-[#08435e] font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Entrando...</span>
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
