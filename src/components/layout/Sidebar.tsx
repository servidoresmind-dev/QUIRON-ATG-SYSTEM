/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  Users,
  ShieldCheck,
  Settings,
  HelpCircle,
  Package,
  Wrench,
  Zap
} from "lucide-react";
import { navigateTo } from "../../utils/navigation";
import { PerfilUsuario } from "../../types";
import quironLogoBall from "../../assets/logo_boll.svg";

interface SidebarProps {
  currentPath: string;
  activeRole?: PerfilUsuario;
}

export default function Sidebar({ currentPath, activeRole }: SidebarProps) {
  const menuItems = [
    {
      path: "dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      hash: "#/dashboard"
    },
    {
      path: "ordens-servico",
      icon: FileSpreadsheet,
      label: "Ordens de Serviço",
      hash: "#/ordens-servico"
    },
    {
      path: "orcamentos",
      icon: Receipt,
      label: "Orçamentos",
      hash: "#/orcamentos"
    },
    {
      path: "clientes",
      icon: Users,
      label: "Clientes & Geradores",
      hash: "#/clientes"
    },
    {
      path: "produtos",
      icon: Package,
      label: "Produtos",
      hash: "#/produtos"
    },
    {
      path: "servicos",
      icon: Wrench,
      label: "Serviços",
      hash: "#/servicos"
    },
    {
      path: "geradores",
      icon: Zap,
      label: "Geradores",
      hash: "#/geradores"
    },
    {
      path: "usuarios",
      icon: ShieldCheck,
      label: "Controle de Usuários",
      hash: "#/usuarios"
    },
    {
      path: "configuracoes",
      icon: Settings,
      label: "Configurações",
      hash: "#/configuracoes"
    }
  ];

  // Restrict access to usuarios if not Admin
  const filteredMenuItems = menuItems.filter(item => {
    if (item.path === "usuarios" && activeRole !== PerfilUsuario.ADMIN) {
      return false;
    }
    return true;
  });

  const getIsActive = (itemPath: string) => {
    if (itemPath === "dashboard" && currentPath === "dashboard") return true;
    if (itemPath === "ordens-servico" && (currentPath === "ordens-servico" || currentPath === "ordens-servico-detail")) return true;
    if (itemPath === "orcamentos" && (currentPath === "orcamentos" || currentPath === "orcamentos-detail")) return true;
    if (itemPath === "clientes" && currentPath === "clientes") return true;
    if (itemPath === "produtos" && currentPath === "produtos") return true;
    if (itemPath === "servicos" && currentPath === "servicos") return true;
    if (itemPath === "geradores" && currentPath === "geradores") return true;
    if (itemPath === "usuarios" && currentPath === "usuarios") return true;
    if (itemPath === "configuracoes" && currentPath === "configuracoes") return true;
    return false;
  };

  return (
    <aside
      id="sidebar"
      className="fixed left-4 top-4 bottom-4 w-20 md:w-24 bg-white border border-slate-200/50 rounded-[32px] flex flex-col items-center py-6 z-40 shadow-soft"
    >
      {/* Brand Logo */}
      <div className="mb-10" id="sidebar-logo">
        <div className="relative w-16 h-16 flex items-center justify-center select-none group cursor-pointer">
          <img src={quironLogoBall} alt="Quiron" className="w-14 h-14" />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-5 w-full px-2" id="sidebar-nav">
        {filteredMenuItems.map((item) => {
          const isActive = getIsActive(item.path);
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              id={`sidebar-item-${item.path}`}
              onClick={() => navigateTo(item.hash)}
              title={item.label}
              className="relative group flex flex-col items-center justify-center w-full py-1.5 transition-all duration-200 cursor-pointer"
            >
              {/* Icon Container with solid green circle when active */}
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isActive
                    ? "bg-brand-500 text-white shadow-lg shadow-brand-500/20 scale-105"
                    : "text-slate-400 hover:text-slate-800 hover:bg-slate-50"
                }`}
              >
                <Icon className="w-5 h-5 stroke-[2]" />
              </div>

              {/* Text Label - very small, elegant */}
              <span
                className={`text-[9px] mt-1 font-bold tracking-tight text-center transition-colors max-w-[80px] truncate uppercase ${
                  isActive ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {item.label.split(" ")[0]}
              </span>

              {/* Tooltip for desktop */}
              <div className="absolute left-24 px-2.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-md opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer with Help and Status Indicator */}
      <div className="mt-auto flex flex-col items-center gap-4" id="sidebar-footer">
        <button
          id="sidebar-help-btn"
          className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          title="Ajuda & Suporte"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Small operational pulse indicator */}
        <div className="flex items-center justify-center h-4 w-4 relative" title="Sistema Operacional">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>
      </div>
    </aside>
  );
}
