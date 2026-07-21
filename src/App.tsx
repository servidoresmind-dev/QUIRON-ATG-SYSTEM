/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import { useHashRoute, navigateTo } from "./utils/navigation";
import { PerfilUsuario } from "./types";
import { Toaster, toast } from "sonner";
import { supabase, isSupabaseConfigured } from "./utils/supabase";
import type { Session, User } from "@supabase/supabase-js";
import { allowedPagesFor, canAccessPage } from "./utils/pages";
import { ShieldAlert } from "lucide-react";

// Import Pages & Components
import Dashboard from "./pages/Dashboard";
import OrdensServico from "./pages/OrdensServico";
import Orcamentos from "./pages/Orcamentos";
import Clientes from "./pages/Clientes";
import Usuarios from "./pages/Usuarios";
import Configuracoes from "./pages/Configuracoes";
import Login from "./pages/Login";
import ProductList from "./components/Products/ProductList";
import ServiceList from "./components/Services/ServiceList";
import Geradores from "./pages/Geradores";
import Historico from "./pages/Historico";

interface CurrentUser {
  email: string;
  nome: string;
  perfil: PerfilUsuario;
  paginasPermitidas: string[] | null;
}

function mapSupabaseUser(user: User): CurrentUser {
  const metaPerfil = user.user_metadata?.perfil;
  const perfil = metaPerfil === PerfilUsuario.ADMIN ? PerfilUsuario.ADMIN : PerfilUsuario.COMUM;
  const paginasPermitidas = Array.isArray(user.user_metadata?.paginas_permitidas)
    ? (user.user_metadata.paginas_permitidas as string[])
    : null;
  return {
    email: user.email || "",
    nome: (user.user_metadata?.nome as string) || user.email || "Usuário",
    perfil,
    paginasPermitidas
  };
}

export default function App() {
  const route = useHashRoute();

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Subscribe to the real Supabase Auth session
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setCheckingSession(false);
      return;
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setCurrentUser(data.session ? mapSupabaseUser(data.session.user) : null);
      setCheckingSession(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setCurrentUser(session ? mapSupabaseUser(session.user) : null);
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  const activeRole = currentUser?.perfil ?? PerfilUsuario.COMUM;
  const allowedPages = currentUser ? allowedPagesFor(activeRole, currentUser.paginasPermitidas) : [];
  // Primeira página da lista do usuário — destino seguro de redirecionamento.
  // null só acontece com Usuário Comum sem nenhuma página marcada.
  const defaultLandingPage = allowedPages[0] ?? null;

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    toast.success("Sessão encerrada.", {
      description: "Você saiu do sistema com segurança."
    });
    navigateTo("login");
  };

  // Route Protection & Authorization Checks (PrivateRoute behavior)
  useEffect(() => {
    if (checkingSession) return;

    if (!currentUser) {
      if (route.path !== "login") {
        navigateTo("login");
      }
      return;
    }

    if (route.path === "login") {
      if (defaultLandingPage) navigateTo(defaultLandingPage);
      return;
    }

    if (!canAccessPage(activeRole, currentUser.paginasPermitidas, route.path)) {
      if (defaultLandingPage && defaultLandingPage !== route.path) {
        navigateTo(defaultLandingPage);
        toast.error("Acesso restrito.", {
          description: "Seu perfil não tem permissão para acessar esta página."
        });
      }
    }
  }, [currentUser, route.path, activeRole, checkingSession, defaultLandingPage]);

  // State for search (we can link this search to any quick dashboard filters)
  const [globalSearch, setGlobalSearch] = useState("");

  const renderActivePage = () => {
    switch (route.path) {
      case "dashboard":
        return <Dashboard />;
      case "ordens-servico":
      case "ordens-servico-detail":
        return <OrdensServico />;
      case "orcamentos":
      case "orcamentos-detail":
        return <Orcamentos />;
      case "clientes":
        return <Clientes activeRole={activeRole} />;
      case "usuarios":
        return <Usuarios activeRole={activeRole} />;
      case "configuracoes":
        return <Configuracoes />;
      case "produtos":
        return <ProductList activeRole={activeRole} />;
      case "servicos":
        return <ServiceList activeRole={activeRole} />;
      case "geradores":
        return <Geradores />;
      case "historico":
        return <Historico activeRole={activeRole} currentUserEmail={currentUser?.email || "desconhecido"} />;
      default:
        return <Dashboard />;
    }
  };

  // Avoid flashing the login screen while we're still checking the Supabase session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" id="app-root">
        <div className="w-8 h-8 border-2 border-[#0B5577] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Render Login only if unauthenticated
  if (!currentUser || route.path === "login") {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col" id="app-root">
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            style: { borderRadius: "14px", border: "1px solid #f1f5f9" },
          }}
        />
        <Login />
      </div>
    );
  }

  // Usuário Comum sem nenhuma página liberada — não há para onde redirecionar.
  if (!defaultLandingPage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 text-center" id="app-root">
        <Toaster position="top-right" richColors closeButton />
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6 border border-rose-100 shadow-soft">
          <ShieldAlert className="w-8 h-8 stroke-[2]" />
        </div>
        <h1 className="text-lg font-bold text-slate-800 tracking-tight">Nenhuma página liberada</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm leading-relaxed">
          Seu usuário ainda não tem nenhuma página de acesso liberada. Fale com um administrador para configurar suas permissões.
        </p>
        <button
          onClick={handleLogout}
          className="mt-8 px-5 py-2.5 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer"
        >
          Sair
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-neutral-bg)] flex" id="app-root">
      {/* Global Toast notifications handler */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: { borderRadius: "14px", border: "1px solid #f1f5f9" },
        }}
      />

      {/* Vertical Icon Sidebar */}
      <Sidebar currentPath={route.path} allowedPages={allowedPages} />

      {/* Main Content Layout Wrapper */}
      <div className="flex-1 pl-28 md:pl-32 pr-4 md:pr-6 flex flex-col min-h-screen py-4">
        {/* Horizontal Navigation Header */}
        <Topbar
          currentPath={route.path}
          activeRole={activeRole}
          searchTerm={globalSearch}
          onSearchChange={setGlobalSearch}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Dynamic Page Container */}
        <main className="p-6 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          {renderActivePage()}
        </main>
      </div>
    </div>
  );
}
