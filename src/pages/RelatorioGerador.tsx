/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertTriangle, RefreshCw, ShieldAlert, CheckCircle2, Info, Download } from "lucide-react";
import { GeradorAtg, OxicatalisadorAtg, PerfilUsuario, Preditiva, Vendedor } from "../types";
import { supabase, isSupabaseConfigured } from "../utils/supabase";
import { navigateTo } from "../utils/navigation";
import { formatDate, formatTime } from "../utils/date";
import { calcularSaude, normalizarStatus, StatusItemSaude } from "../utils/saudeGerador";
import logoAtg from "../assets/logo_boll.svg";

interface RelatorioGeradorProps {
  geradorId?: string;
  activeRole: PerfilUsuario;
}

interface ClienteRelatorio {
  id: number;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj_raw: string | null;
  codigo_omie: string | null;
  vendedor_id: number | null;
}

interface DadosRelatorio {
  gerador: GeradorAtg;
  cliente: ClienteRelatorio;
  vendedor: Pick<Vendedor, "nome" | "email"> | null;
  preditivas: Preditiva[];
  oxi: OxicatalisadorAtg | null;
  emitidoEm: string;
}

const STATUS_INFO: Record<StatusItemSaude, { label: string; badge: string }> = {
  ok: { label: "Em dia", badge: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  a_vencer: { label: "A vencer", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  vencido: { label: "Vencido", badge: "bg-rose-50 text-rose-700 border-rose-200" },
  sem_data: { label: "Sem data registrada", badge: "bg-slate-100 text-slate-600 border-slate-200" },
  nao_aplica: { label: "Não se aplica", badge: "bg-slate-50 text-slate-400 border-slate-200" }
};

function textoPrazo(status: StatusItemSaude, dias: number | null): string {
  if (dias === null) return "";
  if (status === "vencido") {
    const d = Math.abs(dias);
    return `vencido há ${d} dia${d === 1 ? "" : "s"}`;
  }
  if (status === "a_vencer") {
    return dias === 0 ? "vence hoje" : `vence em ${dias} dia${dias === 1 ? "" : "s"}`;
  }
  return "";
}

function Campo({ rotulo, valor, mono = false }: { rotulo: string; valor: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{rotulo}</p>
      <p className={`text-sm font-semibold text-slate-800 break-words ${mono ? "font-mono" : ""}`}>{valor || "—"}</p>
    </div>
  );
}

function BadgeStatus({ status }: { status: StatusItemSaude }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-[11px] font-bold ${STATUS_INFO[status].badge}`}>
      {STATUS_INFO[status].label}
    </span>
  );
}

export default function RelatorioGerador({ geradorId, activeRole }: RelatorioGeradorProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bloqueio, setBloqueio] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosRelatorio | null>(null);

  const carregar = async () => {
    setLoading(true);
    setError(null);
    setBloqueio(null);
    setDados(null);

    if (!isSupabaseConfigured || !supabase) {
      setError("Supabase não configurado.");
      setLoading(false);
      return;
    }

    const id = Number(geradorId);
    if (!Number.isInteger(id) || id <= 0) {
      setBloqueio("Gerador inválido.");
      setLoading(false);
      return;
    }

    try {
      const { data: gerador, error: geradorError } = await supabase
        .from("geradores_atg")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (geradorError) throw geradorError;
      if (!gerador) {
        setBloqueio("Gerador não encontrado.");
        return;
      }
      if (gerador.arquivado) {
        setBloqueio("Este gerador foi removido e não tem relatório.");
        return;
      }

      const { data: cliente, error: clienteError } = await supabase
        .from("omie_clientes")
        .select("id, razao_social, nome_fantasia, cnpj_raw, codigo_omie, vendedor_id")
        .eq("id", gerador.omie_cliente_id)
        .maybeSingle();
      if (clienteError) throw clienteError;
      if (!cliente) {
        setBloqueio("Cliente do gerador não encontrado.");
        return;
      }

      // Vendedor só abre o relatório de gerador de cliente atribuído a ele. A
      // conferência vem ANTES de buscar qualquer dado de preditiva: qualquer falha
      // ou ausência de vínculo bloqueia (falha fechado).
      if (activeRole === PerfilUsuario.VENDEDOR) {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!userId) {
          setBloqueio("Sessão inválida. Entre novamente.");
          return;
        }
        const { data: meuVendedor, error: meuVendedorError } = await supabase
          .from("vendedores")
          .select("id")
          .eq("auth_user_id", userId)
          .maybeSingle();
        if (meuVendedorError) throw meuVendedorError;
        if (!meuVendedor || cliente.vendedor_id !== meuVendedor.id) {
          setBloqueio("Você não tem acesso ao relatório deste gerador.");
          return;
        }
      }

      const [vendedorResult, preditivasResult, oxiResult] = await Promise.all([
        cliente.vendedor_id
          ? supabase.from("vendedores").select("nome, email").eq("id", cliente.vendedor_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("vw_preditivas").select("*").eq("gerador_id", id).order("ordem", { ascending: true }),
        supabase.from("oxicatalisador_atg").select("*").eq("gerador_id", id).maybeSingle()
      ]);
      if (preditivasResult.error) throw preditivasResult.error;

      setDados({
        gerador,
        cliente,
        vendedor: vendedorResult.data ?? null,
        preditivas: preditivasResult.data || [],
        oxi: oxiResult.data ?? null,
        emitidoEm: new Date().toISOString()
      });
    } catch (err: any) {
      setError(err.message || "Erro ao carregar o relatório.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geradorId]);

  const saude = useMemo(() => (dados ? calcularSaude(dados.preditivas) : null), [dados]);

  const voltar = (
    <button
      onClick={() => navigateTo("clientes")}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors shadow-soft cursor-pointer"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span>Voltar para Clientes</span>
    </button>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-slate-100 rounded-xl animate-pulse" />
        <div className="max-w-[820px] mx-auto h-[600px] bg-white border border-slate-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (bloqueio) {
    return (
      <div className="space-y-6">
        <div>{voltar}</div>
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-6 border border-rose-100 shadow-soft">
            <ShieldAlert className="w-8 h-8 stroke-[2]" />
          </div>
          <h1 className="text-lg font-bold text-slate-800 tracking-tight">Relatório indisponível</h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">{bloqueio}</p>
        </div>
      </div>
    );
  }

  if (error || !dados || !saude) {
    return (
      <div className="space-y-6">
        <div>{voltar}</div>
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-md mx-auto shadow-soft">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Falha ao carregar o relatório</h3>
          <p className="text-xs text-slate-500 mt-2 mb-6">{error}</p>
          <button
            onClick={carregar}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl text-xs font-semibold hover:bg-brand-600 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Tentar Novamente</span>
          </button>
        </div>
      </div>
    );
  }

  const { gerador, cliente, vendedor, preditivas, oxi, emitidoEm } = dados;
  const { totais, pendencias, caminho, percentual } = saude;
  const emDia = caminho === 1;

  // O navegador sugere o título da página como nome do arquivo ao "Salvar como
  // PDF" — então o título vira o nome do relatório só durante a impressão.
  const handleBaixarPdf = () => {
    const nomeCliente = cliente.nome_fantasia || cliente.razao_social || "Cliente";
    const serie = gerador.num_serie ? ` - Serie ${gerador.num_serie}` : "";
    const nomeArquivo = `Relatorio de Saude - ${nomeCliente}${serie}`.replace(/[\\/:*?"<>|]/g, " ").trim();

    const tituloAnterior = document.title;
    const restaurar = () => {
      document.title = tituloAnterior;
      window.removeEventListener("afterprint", restaurar);
    };
    window.addEventListener("afterprint", restaurar);
    document.title = nomeArquivo;
    window.print();
  };

  return (
    <div id="relatorio-page" className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        {voltar}
        <div className="flex items-center gap-3">
          <p className="hidden md:block text-[11px] text-slate-400 max-w-[320px] text-right leading-snug">
            Na janela que abrir, escolha <strong className="text-slate-500">Salvar como PDF</strong> e desmarque{" "}
            <strong className="text-slate-500">Cabeçalhos e rodapés</strong>.
          </p>
          <button
            id="relatorio-baixar-pdf"
            onClick={handleBaixarPdf}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Baixar PDF</span>
          </button>
        </div>
      </div>

      {/* Folha do relatório — largura de uma página A4 */}
      <article
        id="relatorio-saude"
        className="bg-white border border-slate-200 rounded-2xl shadow-soft max-w-[820px] mx-auto p-8 md:p-10 space-y-7"
      >
        {/* Cabeçalho */}
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <img src={logoAtg} alt="ATG Geradores" className="w-14 h-14 shrink-0" />
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-brand-600">ATG Geradores</p>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Relatório de Saúde do Gerador</h1>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Emitido em</p>
            <p className="text-xs font-semibold text-slate-700">
              {formatDate(emitidoEm)} às {formatTime(emitidoEm)}
            </p>
          </div>
        </header>

        {/* Resultado */}
        {caminho === null ? (
          <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-slate-50 p-6 flex items-start gap-4">
            <Info className="w-8 h-8 text-slate-400 shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-slate-800">Preditiva ainda não cadastrada</h2>
              <p className="text-sm text-slate-600 mt-1">
                Este gerador ainda não tem itens de manutenção preditiva cadastrados, por isso não foi possível avaliar a
                saúde dele.
              </p>
            </div>
          </section>
        ) : emDia ? (
          <section className="break-inside-avoid rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex items-center gap-5">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 shrink-0" />
            <div>
              <p className="text-4xl font-extrabold text-emerald-700 leading-none">Saúde {percentual}%</p>
              <p className="text-sm text-emerald-800 mt-2 font-medium">
                Seu gerador está em dia. Todos os itens da manutenção preditiva estão dentro do prazo.
              </p>
            </div>
          </section>
        ) : (
          <section
            className={`break-inside-avoid rounded-2xl border p-6 flex flex-col sm:flex-row sm:items-center gap-5 ${
              totais.vencidos > 0 ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="shrink-0">
              <p className={`text-5xl font-extrabold leading-none ${totais.vencidos > 0 ? "text-rose-700" : "text-amber-700"}`}>
                {percentual === null ? "—" : `${percentual}%`}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mt-1">de saúde</p>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">
                Seu gerador tem itens de manutenção preditiva que precisam de atenção.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {totais.vencidos > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 text-rose-700 text-xs font-bold">
                    {totais.vencidos} vencido{totais.vencidos === 1 ? "" : "s"}
                  </span>
                )}
                {totais.aVencer > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-amber-200 text-amber-700 text-xs font-bold">
                    {totais.aVencer} a vencer
                  </span>
                )}
                {totais.semData > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold">
                    {totais.semData} sem data registrada
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-xs font-bold">
                  {totais.ok} em dia
                </span>
              </div>
            </div>
          </section>
        )}

        {/* Cliente e gerador */}
        <section className="break-inside-avoid grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-brand-700 border-b border-slate-100 pb-1.5">
              Cliente
            </h2>
            <Campo rotulo="Razão Social" valor={cliente.razao_social} />
            <Campo rotulo="Nome Fantasia" valor={cliente.nome_fantasia} />
            <Campo rotulo="CNPJ" valor={cliente.cnpj_raw} mono />
          </div>
          <div className="space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-brand-700 border-b border-slate-100 pb-1.5">
              Gerador
            </h2>
            <Campo rotulo="Descrição" valor={gerador.descricao} />
            <div className="grid grid-cols-2 gap-3">
              <Campo rotulo="Fabricante" valor={gerador.fabricante} />
              <Campo rotulo="Modelo" valor={gerador.modelo} />
              <Campo rotulo="Nº de Série" valor={gerador.num_serie} mono />
              <Campo rotulo="Patrimônio" valor={gerador.num_patrimonio} mono />
            </div>
          </div>
        </section>

        {/* Pendências (só quando há) */}
        {pendencias.length > 0 && (
          <section className="break-inside-avoid space-y-3">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-brand-700 border-b border-slate-100 pb-1.5">
              Itens que precisam de atenção
            </h2>
            <ul className="space-y-2">
              {pendencias.map((p, idx) => (
                <li
                  key={`${p.nome}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800">{p.nome}</p>
                    <p className="text-[11px] text-slate-500">
                      {p.dataVencimento ? `Vencimento: ${formatDate(p.dataVencimento)}` : "Sem data de vencimento registrada"}
                      {textoPrazo(p.status, p.diasParaVencer) ? ` · ${textoPrazo(p.status, p.diasParaVencer)}` : ""}
                    </p>
                  </div>
                  <BadgeStatus status={p.status} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Todos os itens */}
        <section className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-brand-700 border-b border-slate-100 pb-1.5">
            Situação de todos os itens da preditiva
          </h2>
          {preditivas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum item de preditiva cadastrado para este gerador.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">Item</th>
                  <th className="py-2 pr-3">Última realização</th>
                  <th className="py-2 pr-3">Vencimento</th>
                  <th className="py-2 text-right">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preditivas.map((p) => {
                  const status = normalizarStatus(p);
                  return (
                    <tr key={p.id} className="break-inside-avoid">
                      <td className="py-2 pr-3 font-semibold text-slate-800">{p.item_nome}</td>
                      <td className="py-2 pr-3 text-slate-600">{p.data_realizada ? formatDate(p.data_realizada) : "—"}</td>
                      <td className="py-2 pr-3 text-slate-600">{p.data_vencimento ? formatDate(p.data_vencimento) : "—"}</td>
                      <td className="py-2 text-right">
                        <BadgeStatus status={status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <p className="text-xs text-slate-500">
            <span className="font-bold text-slate-600">Oxicatalisador:</span>{" "}
            {oxi?.possui === true ? "Possui" : oxi?.possui === false ? "Não possui" : "Não informado"}
            {oxi?.possui === true && oxi?.bitola ? ` · Bitola: ${oxi.bitola}` : ""}
            <span className="text-slate-400"> (informativo — não entra no cálculo da saúde)</span>
          </p>
        </section>

        {/* Fechamento */}
        <section className="break-inside-avoid rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <h2 className="text-sm font-bold text-slate-800">
            {emDia ? "Mantenha o plano em dia" : "Próximos passos"}
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {emDia
              ? "Continue acompanhando os prazos para manter a saúde do seu gerador em 100%."
              : "Para regularizar a manutenção preditiva do seu gerador, fale com o seu consultor ATG."}
          </p>
          <p className="text-sm font-semibold text-slate-800 mt-3">
            {vendedor ? (
              <>
                {vendedor.nome}
                {vendedor.email ? <span className="font-normal text-slate-500"> · {vendedor.email}</span> : null}
              </>
            ) : (
              "ATG Geradores"
            )}
          </p>
        </section>

        <footer className="border-t border-slate-100 pt-4 text-[10px] leading-relaxed text-slate-400">
          Situação calculada a partir das datas de vencimento registradas no sistema ATG. "A vencer" indica vencimento em
          até 30 dias. Itens marcados como "Não se aplica" não entram no cálculo.
        </footer>
      </article>
    </div>
  );
}
