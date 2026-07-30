import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { ClienteCard, GeradorAtg } from "../../types";
import Modal from "../ui/Modal";
import {
  buscarAtivoPorOs,
  criarGerador,
  BuscarAtivoPorOsResultSucesso,
  BuscarAtivoPorOsResultFalha,
  classificarErroWebhook,
  TipoErroWebhook
} from "../../utils/atgBackend";
import { toast } from "sonner";

interface AdicionarGeradorPorOsWizardProps {
  cliente: ClienteCard;
  usuario: string;
  onClose: () => void;
  onCreated: (novo: GeradorAtg) => void;
}

type Step = "os" | "multiplos" | "form" | "revisao";

export default function AdicionarGeradorPorOsWizard({ cliente, usuario, onClose, onCreated }: AdicionarGeradorPorOsWizardProps) {
  const [step, setStep] = useState<Step>("os");
  const [codigoOs, setCodigoOs] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<{ tipo: TipoErroWebhook; mensagem: string } | null>(null);
  const [opcoes, setOpcoes] = useState<{ ativo_id: number; descricao: string }[]>([]);
  const [ativo, setAtivo] = useState<BuscarAtivoPorOsResultSucesso | null>(null);

  const [formFabricante, setFormFabricante] = useState("");
  const [formModelo, setFormModelo] = useState("");
  const [formNumSerie, setFormNumSerie] = useState("");
  const [creating, setCreating] = useState(false);

  const handleBuscarOs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoOs.trim()) {
      toast.error("Digite o número da O.S.");
      return;
    }

    setLoading(true);
    setErro(null);
    const result = await buscarAtivoPorOs(codigoOs.trim());
    setLoading(false);

    if (result.ok && "multiplos" in result && result.multiplos) {
      setOpcoes(result.opcoes);
      setStep("multiplos");
      return;
    }

    if (result.ok) {
      const sucesso = result as BuscarAtivoPorOsResultSucesso;
      setAtivo(sucesso);
      setFormFabricante(sucesso.fabricante || "");
      setFormModelo(sucesso.modelo || "");
      setFormNumSerie(sucesso.num_serie || "");
      setStep("form");
      return;
    }

    setErro(
      classificarErroWebhook(
        (result as BuscarAtivoPorOsResultFalha).motivo,
        "Nenhum ativo encontrado para esse número de O.S. Confira o código e tente novamente."
      )
    );
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
    setFormNumSerie("");
    setStep("form");
  };

  const handleCriar = async () => {
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
      if (!result || typeof result.id !== "number") {
        throw new Error("A criação não foi confirmada pelo backend.");
      }

      const novo: GeradorAtg = {
        id: result.id,
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
        ficha_validada_em: null,
        arquivado: false,
        arquivado_por: null,
        arquivado_em: null
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
    <Modal id="adicionar-gerador-por-os-modal" isOpen={true} onClose={onClose} title={`Adicionar Gerador por O.S. — ${cliente.razao_social}`}>
      <div className="space-y-4">
        {step === "os" && (
          <form onSubmit={handleBuscarOs} className="space-y-3">
            <p className="text-xs text-slate-500">Digite o número da O.S. para localizar o ativo vinculado a ela no iClass.</p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={codigoOs}
                onChange={(e) => setCodigoOs(e.target.value)}
                placeholder="Ex: OS-12345"
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

        {erro && step === "os" && (
          <div
            className={`border text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2 ${
              erro.tipo === "comunicacao"
                ? "bg-red-50 border-red-100 text-red-700"
                : erro.tipo === "rate_limit"
                ? "bg-amber-50 border-amber-100 text-amber-800"
                : "bg-red-50 border-red-100 text-red-700"
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro.mensagem}</span>
          </div>
        )}

        {step === "multiplos" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">Essa O.S. tem múltiplos ativos vinculados. Selecione o correto:</p>
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
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("revisao");
            }}
            className="space-y-4"
          >
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
              className="w-full py-2.5 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer"
            >
              Revisar e Confirmar
            </button>
          </form>
        )}

        {step === "revisao" && ativo && (
          <div className="space-y-4">
            <div className="bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Confira os dados abaixo. O gerador só é criado depois que você confirmar.</span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-xs">
              <p><span className="text-slate-400">O.S.:</span> <span className="font-mono font-semibold text-slate-700">{codigoOs.trim() || "—"}</span></p>
              <p><span className="text-slate-400">Fabricante:</span> <span className="font-semibold text-slate-700">{formFabricante || "—"}</span></p>
              <p><span className="text-slate-400">Modelo:</span> <span className="font-semibold text-slate-700">{formModelo || "—"}</span></p>
              <p><span className="text-slate-400">Número de Série:</span> <span className="font-mono font-semibold text-slate-700">{formNumSerie || "—"}</span></p>
              <p><span className="text-slate-400">Descrição (iClass):</span> <span className="font-semibold text-slate-700">{ativo.descricao || "—"}</span></p>
              <p><span className="text-slate-400">ID iClass:</span> <span className="font-mono font-semibold text-slate-700">{ativo.ativo_id}</span></p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCriar}
                disabled={creating}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors shadow-soft cursor-pointer disabled:opacity-60"
              >
                {creating ? "Criando..." : "Confirmar Criação"}
              </button>
              <button
                onClick={() => setStep("form")}
                disabled={creating}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-60"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
