/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Bell, Search, ShieldAlert, LogOut } from "lucide-react";
import { PerfilUsuario } from "../../types";

interface TopbarProps {
  currentPath: string;
  activeRole: PerfilUsuario;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  currentUser?: { email: string; nome: string; perfil: PerfilUsuario } | null;
  onLogout?: () => void;
}

const ROLE_LABELS: Record<PerfilUsuario, string> = {
  [PerfilUsuario.ADMIN]: "Administrador",
  [PerfilUsuario.COMUM]: "Usuário Comum"
};

export default function Topbar({
  currentPath,
  activeRole,
  searchTerm,
  onSearchChange,
  currentUser,
  onLogout
}: TopbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);

  // Dynamic breadcrumbs based on the path
  const getBreadcrumbs = () => {
    const parts = [
      { label: "Início", href: "#/dashboard" }
    ];

    if (currentPath === "dashboard") {
      parts.push({ label: "Dashboard", href: "#/dashboard" });
    } else if (currentPath === "ordens-servico") {
      parts.push({ label: "Ordens de Serviço", href: "#/ordens-servico" });
    } else if (currentPath === "ordens-servico-detail") {
      parts.push({ label: "Ordens de Serviço", href: "#/ordens-servico" });
      parts.push({ label: "Detalhe da O.S.", href: "" });
    } else if (currentPath === "orcamentos") {
      parts.push({ label: "Orçamentos", href: "#/orcamentos" });
    } else if (currentPath === "orcamentos-detail") {
      parts.push({ label: "Orçamentos", href: "#/orcamentos" });
      parts.push({ label: "Detalhe do Orçamento", href: "" });
    } else if (currentPath === "clientes") {
      parts.push({ label: "Clientes", href: "#/clientes" });
    } else if (currentPath === "usuarios") {
      parts.push({ label: "Usuários", href: "#/usuarios" });
    } else if (currentPath === "configuracoes") {
      parts.push({ label: "Configurações", href: "#/configuracoes" });
    } else if (currentPath === "produtos") {
      parts.push({ label: "Produtos", href: "#/produtos" });
    } else if (currentPath === "servicos") {
      parts.push({ label: "Serviços", href: "#/servicos" });
    } else if (currentPath === "geradores") {
      parts.push({ label: "Geradores", href: "#/geradores" });
    }

    return parts;
  };

  const breadcrumbs = getBreadcrumbs();

  const mockNotifications = [
    {
      id: 1,
      title: "Inconsistência na O.S. OS-2026-002",
      description: "Erro detectado: Inconsistência de valores.",
      time: "10 min atrás",
      unread: true
    },
    {
      id: 2,
      title: "Novo Cliente Cadastrado",
      description: "Metalúrgica Ferro Forte adicionado com gerador.",
      time: "2 horas atrás",
      unread: false
    },
    {
      id: 3,
      title: "Orçamento Processado",
      description: "ORC-2026-001 enviado para faturamento com sucesso.",
      time: "1 dia atrás",
      unread: false
    }
  ];

  return (
    <header
      id="topbar"
      className="h-16 bg-white/90 backdrop-blur-md border border-slate-200/50 flex items-center justify-between px-6 rounded-[24px] sticky top-4 z-30 shadow-soft mb-6"
    >
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2" id="topbar-breadcrumbs">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300 text-xs">/</span>}
              {crumb.href && !isLast ? (
                <a
                  href={crumb.href}
                  className="text-xs md:text-sm font-medium text-slate-500 hover:text-brand-500 transition-colors"
                >
                  {crumb.label}
                </a>
              ) : (
                <span className="text-xs md:text-sm font-semibold text-slate-800">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4" id="topbar-actions">
        {/* Global Quick Search - beautifully animated */}
        <div className="relative hidden lg:block">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            id="topbar-global-search"
            type="text"
            placeholder="Pesquisar..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-48 xl:w-64 pl-9 pr-4 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 focus:bg-white focus:w-72 transition-all duration-300"
          />
        </div>

        {/* Current Access Role Badge */}
        <div
          id="topbar-role-badge"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 border border-brand-100 rounded-xl text-brand-700 select-none"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span className="text-[11px] font-semibold tracking-wide">
            Perfil: {ROLE_LABELS[activeRole]}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            id="topbar-notification-btn"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl relative transition-all"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl py-3 z-50 animate-fade-in">
              <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Notificações</span>
                <span className="text-[10px] text-brand-500 font-semibold cursor-pointer hover:underline">
                  Marcar todas como lidas
                </span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`px-4 py-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 ${
                      notif.unread ? "bg-brand-50/20" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span>{notif.title}</span>
                        {notif.unread && (
                          <span className="w-1.5 h-1.5 bg-rose-500 rounded-full inline-block"></span>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {notif.description}
                      </p>
                      <span className="text-[9px] text-slate-400 font-medium block mt-1">
                        {notif.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar / Details */}
        <div className="flex items-center gap-3 border-l border-slate-200 pl-4 animate-fade-in" id="topbar-profile">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-[#0B5577] border border-[#0B5577]/10 shadow-xs font-bold text-sm">
            {currentUser?.nome ? currentUser.nome.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() : "US"}
          </div>
          <div className="hidden sm:block text-left mr-1">
            <p className="text-xs font-bold text-slate-800">
              {currentUser?.nome || "Usuário"}
            </p>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wide uppercase">
              {ROLE_LABELS[activeRole]}
            </p>
          </div>
          
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
              title="Sair do sistema"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
