/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Settings, Info, Cloud, Database, Cpu } from "lucide-react";

export default function Configuracoes() {
  return (
    <div id="configuracoes-page" className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-brand-500" />
          <span>Configurações do Sistema</span>
        </h1>
        <p className="text-sm text-slate-500">
          Consulte o status do servidor e veja as configurações operacionais aplicadas nesta compilação.
        </p>
      </div>

      {/* Info Sections */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-soft space-y-6">
        {/* Connection status */}
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Status da API & Banco</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Conectado ao Supabase · Clientes ainda utiliza dados locais (tabela em preparação).
            </p>
          </div>
        </div>

        {/* System info */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informações de Compilação</h4>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Ambiente</span>
                <span className="font-semibold text-slate-700">Produção</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-slate-400" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Banco de Dados</span>
                <span className="font-semibold text-slate-700">Supabase (PostgreSQL)</span>
              </div>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="pt-4 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Info className="w-4 h-4 text-brand-500" />
            <span>Sobre este Sistema</span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Painel operacional da ATG Geradores para gestão de Ordens de Serviço e Orçamentos, com autenticação real via Supabase Auth, exportação de relatórios em Excel (SheetJS) e controle de acesso por perfil (Administrador / Usuário Comum).
          </p>
        </div>
      </div>
    </div>
  );
}
