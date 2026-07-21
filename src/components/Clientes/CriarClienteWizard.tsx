import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import Modal from "../ui/Modal";
import { criarCliente, CriarClientePayload } from "../../utils/atgBackend";
import { supabase } from "../../utils/supabase";
import { registrarLog } from "../../utils/logEdicoes";
import { toast } from "sonner";

interface CriarClienteWizardProps {
  usuario: string;
  onClose: () => void;
  onCreated: () => void;
}

type FormState = Omit<CriarClientePayload, "usuario">;

const CAMPOS_OBRIGATORIOS: { key: keyof FormState; label: string }[] = [
  { key: "razao_social", label: "Razão Social" },
  { key: "nome_fantasia", label: "Nome Fantasia" },
  { key: "cnpj_cpf", label: "CNPJ/CPF" },
  { key: "email", label: "E-mail" },
  { key: "telefone_ddd", label: "DDD do Telefone" },
  { key: "telefone_numero", label: "Número do Telefone" },
  { key: "celular", label: "Celular" },
  { key: "endereco", label: "Endereço (rua)" },
  { key: "endereco_numero", label: "Número" },
  { key: "bairro", label: "Bairro" },
  { key: "cidade", label: "Cidade" },
  { key: "estado", label: "Estado" },
  { key: "cep", label: "CEP" }
];

const EMPTY_FORM: FormState = {
  razao_social: "",
  nome_fantasia: "",
  cnpj_cpf: "",
  email: "",
  telefone_ddd: "",
  telefone_numero: "",
  celular: "",
  endereco: "",
  endereco_numero: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
  observacao: ""
};

// cnpj_raw no banco é guardado formatado (ex: "01.642.931/0001-56"), como já
// vem nos registros existentes — aqui só formata o que o usuário digitou.
function formatCnpjCpf(valor: string): string {
  const d = valor.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return valor;
}

export default function CriarClienteWizard({ usuario, onClose, onCreated }: CriarClienteWizardProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [faltando, setFaltando] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setCampo = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    const faltandoLocal = CAMPOS_OBRIGATORIOS.filter((c) => !form[c.key].trim()).map((c) => c.key);
    if (faltandoLocal.length > 0) {
      setFaltando(faltandoLocal);
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setFaltando([]);

    if (!supabase) return;
    setSubmitting(true);

    const payload: CriarClientePayload = { ...form, cnpj_cpf: form.cnpj_cpf.replace(/\D/g, ""), usuario };
    const result = await criarCliente(payload);

    if (result.status === "campos_faltando") {
      setSubmitting(false);
      setFaltando(result.faltando);
      toast.error("Faltam campos obrigatórios.", { description: result.faltando.join(", ") });
      return;
    }

    if (result.status === "falha_omie") {
      setSubmitting(false);
      setErro(result.mensagem || "Falha ao criar no Omie. Nada foi cadastrado. Verifique os dados e tente novamente.");
      toast.error("Falha ao criar cliente no Omie.", { description: result.omie_erro });
      return;
    }

    // status "completo" | "iclass_sem_id" | "iclass_pendente" — em todos, o
    // Omie já foi criado, então grava no nosso banco (nunca perde o dado).
    const iclassPendente = result.status === "iclass_pendente";
    const cnpjLimpo = payload.cnpj_cpf;

    const insertPayload = {
      razao_social: form.razao_social,
      nome_fantasia: form.nome_fantasia,
      cnpj_raw: formatCnpjCpf(cnpjLimpo),
      cnpj_limpo: cnpjLimpo,
      codigo_omie: String(result.codigo_cliente_omie),
      iclass_id_encontrado: iclassPendente ? null : result.iclass_id,
      iclass_nome: iclassPendente ? null : result.iclass_nome ?? null,
      iclass_codigo_encontrado: iclassPendente ? null : result.iclass_codigo ?? null,
      iclass_pendente: iclassPendente
    };

    const { data, error: insertError } = await supabase.from("omie_clientes").insert(insertPayload).select().single();

    setSubmitting(false);

    if (insertError) {
      toast.error("Cliente foi criado no Omie/iClass, mas falhou ao salvar no nosso banco.", {
        description: insertError.message
      });
      setErro(
        `Atenção: o cliente já existe no Omie (código ${result.codigo_cliente_omie}), mas não foi possível salvar aqui. Erro: ${insertError.message}`
      );
      return;
    }

    await registrarLog(
      "cliente",
      data.id,
      iclassPendente ? "criou_cliente_iclass_pendente" : "criou_cliente",
      usuario,
      null,
      insertPayload
    );

    if (iclassPendente) {
      toast.warning("Cliente criado no Omie — finalize manualmente no iClass.", {
        description: result.iclass_erro,
        duration: 8000
      });
    } else if (result.status === "iclass_sem_id") {
      toast.warning("Cliente criado, mas o ID do iClass não foi capturado.", {
        description: "Confira e complete manualmente pelo botão \"Corrigir cadastro iClass\".",
        duration: 8000
      });
    } else {
      toast.success("Cliente criado com sucesso nos dois sistemas!");
    }

    onCreated();
    onClose();
  };

  const campoInvalido = (key: keyof FormState) => faltando.includes(key);

  return (
    <Modal id="criar-cliente-modal" isOpen={true} onClose={onClose} title="Novo Cliente (Omie + iClass)" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-brand-50 border border-brand-100 rounded-xl p-3 flex items-start gap-2.5">
          <UserPlus className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-brand-700 leading-snug">
            Preenche o formulário uma vez só — o cliente é criado no Omie e no iClass ao mesmo tempo. Todos os campos
            são obrigatórios, exceto Observação.
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 border border-red-100 text-red-700 text-xs font-semibold rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { key: "razao_social" as const, label: "Razão Social" },
            { key: "nome_fantasia" as const, label: "Nome Fantasia" },
            { key: "cnpj_cpf" as const, label: "CNPJ/CPF", placeholder: "Só números" },
            { key: "email" as const, label: "E-mail" },
            { key: "telefone_ddd" as const, label: "DDD do Telefone", placeholder: "Ex: 11" },
            { key: "telefone_numero" as const, label: "Número do Telefone", placeholder: "Ex: 99999-9999" },
            { key: "celular" as const, label: "Celular" },
            { key: "endereco" as const, label: "Endereço (rua)" },
            { key: "endereco_numero" as const, label: "Número" },
            { key: "bairro" as const, label: "Bairro" },
            { key: "cidade" as const, label: "Cidade", placeholder: 'Ex: São Paulo (SP)' },
            { key: "estado" as const, label: "Estado", placeholder: "Ex: SP" },
            { key: "cep" as const, label: "CEP", placeholder: "Só números" }
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">{label}</label>
              <input
                type="text"
                value={form[key]}
                placeholder={placeholder}
                disabled={submitting}
                onChange={(e) => setCampo(key, e.target.value)}
                className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 ${
                  campoInvalido(key) ? "border-rose-300 bg-rose-50" : "border-slate-200"
                }`}
              />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
              Observação <span className="normal-case font-normal text-slate-300">(opcional)</span>
            </label>
            <textarea
              value={form.observacao}
              disabled={submitting}
              onChange={(e) => setCampo("observacao", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 bg-brand-500 text-white rounded-xl font-bold text-xs hover:bg-brand-600 transition-colors shadow-soft cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          {submitting ? "Criando..." : "Criar Cliente"}
        </button>
      </form>
    </Modal>
  );
}
