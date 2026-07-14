import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Search, Ban } from "lucide-react";
import { ClienteCard, GeradorAtg } from "../../types";
import Modal from "../ui/Modal";
import { buscarAtivo, criarGerador, BuscarAtivoResultSucesso } from "../../utils/atgBackend";
import { toast } from "sonner";

interface AdicionarGeradorWizardProps {
  cliente: ClienteCard;
  usuario: string;
  onClose: () => void;
  onCreated: (novo: GeradorAtg) => void;
}

type Step = "serie" | "patrimonio" | "bloqueado" | "multiplos" | "form";

export default function AdicionarGeradorWizard({ cliente, usuario, onClose, onCreated }: AdicionarGeradorWizardProps) {
  const [step, setStep] = useState<Step>("serie");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<{ ativo_id: number; descricao: string }[]>([]);
  const [ativo, setAtivo] = useState<BuscarAtivoResultSucesso | null>(null);

  const [formFabricante, setFormFabricante] = useState("");
  const [formModelo, setFormModelo] = useState("");
  const [formNumSerie, setFormNumSerie] = useState("");
  const [creating, setCreating] = useState(false);

  const handleBuscarSerie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor.trim()) {
      toast.error("Digite o número de série.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const numSerie = valor.trim();
    const result = await buscarAtivo("serialNumber", numSerie);
    setLoading(false);

    if (result.ok && "multiplos" in result && result.multiplos) {
      setOpcoes(result.opcoes);
      setFormNumSerie(numSerie);
      setStep("multiplos");
      return;
    }

    if (result.ok) {
      setAtivo(result as BuscarAtivoResultSucesso);
      setFormFabricante((result as BuscarAtivoResultSucesso).fabricante);
      setFormModelo((result as BuscarAtivoResultSucesso).modelo);
      setFormNumSerie(numSerie);
      setStep("form");
      return;
    }

    // Falhou pela série — tenta patrimônio a seguir
    setValor("");
    setStep("patrimonio");
  };

  const handleBuscarPatrimonio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor.trim()) {
      toast.error("Digite o número de patrimônio.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    const numPatrimonio = valor.trim();
    const result = await buscarAtivo("patrimony", numPatrimonio);
    setLoading(false);

    if (result.ok && "multiplos" in result && result.multiplos) {
      setOpcoes(result.opcoes);
      setStep("multiplos");
      return;
    }

    if (result.ok) {
      setAtivo(result as BuscarAtivoResultSucesso);
      setFormFabricante((result as BuscarAtivoResultSucesso).fabricante);
      setFormModelo((result as BuscarAtivoResultSucesso).modelo);
      setStep("form");
      return;
    }

    // Falhou de novo — bloqueia
    setStep("bloqueado");
  };

  const handleEscolherOpcao = (opcao: { ativo_id: number; descricao: string }) => {
    setAtivo({
      ok: true,
      ativo_id: opcao.ativo_id,
      descricao: opcao.descricao,
      fabricante: "",
      modelo: "",
      status_ativo: ""
    });
    setFormFabricante("");
    setFormModelo("");
    setStep("form");
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ativo) return;

    setCreating(true);
    try {
      const dados = {
        fabricante: formFabricante || null,
        modelo: formModelo || null,
        num_serie: formNumSerie || null,
        descricao: ativo.descricao || null,
        status_ativo: ativo.status_ativo || null
      };

      const result = await criarGerador(cliente.id, ativo.ativo_id, dados, usuario);
      if (!result.ok) throw new Error("A criação não foi confirmada pelo backend.");

      const novo: GeradorAtg = {
        id: result.id ?? -Date.now(),
        omie_cliente_id: cliente.id,
        nome_fantasia: cliente.nome_fantasia,
        razao_social: cliente.razao_social,
        cnpj_limpo: cliente.cnpj_limpo,
        iclass_id_cliente: cliente.iclass_id_encontrado,
        iclass_codigo_cliente: cliente.iclass_codigo_encontrado,
        num_serie: formNumSerie || null,
        num_patrimonio: null,
        descricao: ativo.descricao,
        fabricante: formFabricante || null,
        modelo: formModelo || null,
        ativo_id: ativo.ativo_id,
        status_ativo: ativo.status_ativo || null,
        tipo_equipamento: null,
        observacao_ativo: null,
        processado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
        codigo_os_ficha_levantamento: null,
        observacao_os_ficha_levantamento: null,
        checklist_pesquisa_id: null,
        ficha_levantamento: null,
        checklist_status: null,
        checklist_processado_em: null,
        validado: false,
        validado_por: null,
        validado_em: null,
        ficha_validada_por_humano: false,
        ficha_validada_por: null,
        ficha_validada_em: null
      };

      toast.success("Gerador criado com sucesso! Agora vincule a ficha de levantamento.");
      onCreated(novo);
    } catch (err: any) {
      toast.error("Erro ao criar gerador.", { description: err.message });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal id="adicionar-gerador-modal" isOpen={true} onClose={onClose} title={`Adicionar Gerador — ${cliente.razao_social}`}>
      <div className="space-y-4">
        {step === "serie" && (
          <form onSubmit={handleBuscarSerie} className="space-y-3">
            <p className="text-xs text-slate-500">Digite o número de série do gerador para localizá-lo no iClass.</p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Número de série"
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>
        )}

        {step === "patrimonio" && (
          <form onSubmit={handleBuscarPatrimonio} className="space-y-3">
            <div className="bg-amber-50 border border-amber-100 text-amber-800 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Não encontrado por número de série. Tente pelo número de patrimônio.</span>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="Número de patrimônio"
                disabled={loading}
                className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-brand-500 text-white rounded-xl font-semibold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {loading ? "Buscando..." : "Buscar"}
              </button>
            </div>
          </form>
        )}

        {step === "bloqueado" && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-rose-100">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Ativo não cadastrado no iClass</h3>
            <p className="text-xs text-slate-500 mt-1">Cadastre o ativo no iClass primeiro antes de vinculá-lo aqui.</p>
          </div>
        )}

        {step === "multiplos" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">O iClass encontrou múltiplos ativos. Selecione o correto:</p>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl max-h-64 overflow-y-auto">
              {opcoes.map((opcao) => (
                <button
                  key={opcao.ativo_id}
                  onClick={() => handleEscolherOpcao(opcao)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-slate-700">{opcao.descricao}</span>
                  <span className="text-[10px] font-mono text-slate-400">{opcao.ativo_id}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "form" && ativo && (
          <form onSubmit={handleCriar} className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Ativo localizado: {ativo.descricao} (ID iClass: {ativo.ativo_id})</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Fabricante</label>
                <input
                  type="text"
                  value={formFabricante}
                  onChange={(e) => setFormFabricante(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Modelo</label>
                <input
                  type="text"
                  value={formModelo}
                  onChange={(e) => setFormModelo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Número de Série</label>
                <input
                  type="text"
                  value={formNumSerie}
                  onChange={(e) => setFormNumSerie(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="w-full py-2.5 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
            >
              {creating ? "Criando..." : "Criar Gerador"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
