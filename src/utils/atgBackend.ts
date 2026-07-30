// Integração com o backend do SaaS Preditivas ATG (RPCs Supabase + webhooks n8n)
// descrito em "Orientação Frontend.md".
//
// As 3 RPCs ainda não existem no Supabase (confirmado: retornam PGRST202) —
// pra essas, ainda usamos uma resposta mockada como fallback, marcada com
// _mocked:true, pra manter o fluxo testável enquanto o backend não é concluído.
//
// Os webhooks n8n (buscar-ativo, buscar-os, buscar-cliente-iclass, criar-cliente)
// já são reais e síncronos em produção — por isso NÃO caem mais em mock quando
// falham. Se o webhook não responder (rede fora do ar, URL errada, n8n
// desligado) ou responder num formato inesperado, o resultado é um erro
// explícito (motivo/status "erro_comunicacao"), pra UI avisar o usuário e
// pedir pra tentar de novo — nunca fingir sucesso com dado falso.

import { supabase } from "./supabase";
import { toast } from "sonner";

const WEBHOOK_URLS = {
  buscarAtivo: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-ativo",
  buscarOs: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-os",
  buscarClienteIclass: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-cliente-iclass",
  criarCliente: "https://main-n8n.1smjgn.easypanel.host/webhook/criar-cliente",
  buscarAtivoPorOs: "https://main-n8n.1smjgn.easypanel.host/webhook/gerador-por-os"
};

// Toda função de mock devolve esse marcador junto com o resultado, para que a
// UI possa deixar bem claro (não só no console) que aquele resultado não veio
// do backend de verdade.
export interface Mockable {
  _mocked?: boolean;
}

function warnMocked(mensagem: string) {
  console.warn(`[mock] ${mensagem}`);
  toast.warning("Resposta simulada (backend ainda não pronto)", {
    description: mensagem,
    duration: 6000
  });
}

export async function callRpc<T extends Mockable>(
  name: string,
  params: Record<string, unknown>,
  mockResponse: () => T
): Promise<T> {
  if (!supabase) throw new Error("Supabase não configurado.");

  const { data, error } = await supabase.rpc(name, params);

  if (!error) return data as T;

  if (error.code === "PGRST202") {
    warnMocked(`A função "${name}" ainda não existe no backend — usando resposta simulada.`);
    await new Promise((resolve) => setTimeout(resolve, 400));
    return { ...mockResponse(), _mocked: true };
  }

  throw error;
}

// Webhooks já são reais — em falha, devolve um erro explícito (nunca mock).
// `erroComunicacao` monta o objeto de falha no formato específico de cada
// endpoint (uns usam `motivo`, o de criar-cliente usa `status`).
async function callWebhook<T extends { ok: boolean } & Mockable>(
  url: string,
  body: unknown,
  erroComunicacao: () => T
): Promise<T> {
  let json: any = null;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    json = await response.json().catch(() => null);
  } catch (err) {
    console.error(`Falha de rede ao chamar webhook "${url}".`, err);
  }

  if (json && typeof json === "object" && "ok" in json) {
    return json as T;
  }

  console.error(`Webhook "${url}" não respondeu no formato esperado.`, json);
  return erroComunicacao();
}

// Classifica um `motivo`/`status` de falha de webhook nos 2 casos genéricos
// (sobrecarga do iClass, falha de comunicação) ou devolve a mensagem padrão
// específica de quem chamou (ex: "cliente não encontrado").
export type TipoErroWebhook = "rate_limit" | "comunicacao" | "outro";

export function classificarErroWebhook(
  motivoOuStatus: string | undefined,
  mensagemPadrao: string
): { tipo: TipoErroWebhook; mensagem: string } {
  if (motivoOuStatus === "rate_limit_excedido") {
    return {
      tipo: "rate_limit",
      mensagem: "O sistema do iClass está sobrecarregado no momento. Aguarde alguns instantes e tente novamente."
    };
  }
  if (motivoOuStatus === "erro_comunicacao") {
    return {
      tipo: "comunicacao",
      mensagem: "Não foi possível se comunicar com o servidor. Tente novamente."
    };
  }
  return { tipo: "outro", mensagem: mensagemPadrao };
}

// ── Fluxo A: validar cadastro ──

export interface ValidarCadastroResult extends Mockable {
  ok: boolean;
}

export function validarCadastro(
  entidade: "cliente" | "gerador",
  id: number,
  usuario: string,
  validar: boolean
): Promise<ValidarCadastroResult> {
  return callRpc<ValidarCadastroResult>(
    "validar_cadastro",
    { p_entidade: entidade, p_id: id, p_usuario: usuario, p_validar: validar },
    () => ({ ok: true })
  );
}

// ── Fluxo Preditiva: salvar item ──

export interface SalvarPreditivaResult extends Mockable {
  ok: boolean;
}

export function salvarPreditiva(
  id: number,
  campos: Record<string, unknown>,
  usuario: string
): Promise<SalvarPreditivaResult> {
  return callRpc<SalvarPreditivaResult>(
    "salvar_preditiva",
    { p_id: id, p_campos: campos, p_usuario: usuario },
    () => ({ ok: true })
  );
}

// ── Fluxo C: buscar ativo no iClass ──

export interface BuscarAtivoResultSucesso extends Mockable {
  ok: true;
  ativo_id: number;
  descricao: string;
  fabricante: string;
  modelo: string;
  status_ativo: string;
}
export interface BuscarAtivoResultMultiplos {
  ok: true;
  multiplos: true;
  opcoes: { ativo_id: number; descricao: string }[];
}
export interface BuscarAtivoResultFalha {
  ok: false;
  motivo: string;
}
export type BuscarAtivoResult = BuscarAtivoResultSucesso | BuscarAtivoResultMultiplos | BuscarAtivoResultFalha;

export function buscarAtivo(por: "serialNumber" | "patrimony", valor: string): Promise<BuscarAtivoResult> {
  return callWebhook<BuscarAtivoResult>(WEBHOOK_URLS.buscarAtivo, { por, valor }, () => ({
    ok: false,
    motivo: "erro_comunicacao"
  }));
}

// ── Fluxo B: buscar OS / ficha de levantamento ──

export interface BuscarOsResultSucesso extends Mockable {
  ok: true;
  codigo_os: string;
  checklist_pesquisa_id: number;
  ficha_levantamento: Record<string, Record<string, string>>;
}
export interface BuscarOsResultFalha {
  ok: false;
  motivo: string;
}
export type BuscarOsResult = BuscarOsResultSucesso | BuscarOsResultFalha;

export function buscarOs(ativoId: number, codigoOs: string): Promise<BuscarOsResult> {
  return callWebhook<BuscarOsResult>(
    WEBHOOK_URLS.buscarOs,
    { ativo_id: ativoId, codigo_os: codigoOs },
    () => ({ ok: false, motivo: "erro_comunicacao" })
  );
}

// ── Corrigir cadastro iClass: buscar cliente no iClass por código/nome/CNPJ ──

export interface BuscarClienteIclassEncontrado {
  iclass_id: number;
  iclass_nome: string;
  iclass_codigo: string;
  cnpj: string;
  email?: string;
  telefone?: string;
}
export interface BuscarClienteIclassResultSucesso extends Mockable {
  ok: true;
  total: number;
  encontrados: BuscarClienteIclassEncontrado[];
}
export interface BuscarClienteIclassResultFalha extends Mockable {
  ok: false;
  motivo: string;
}
export type BuscarClienteIclassResult = BuscarClienteIclassResultSucesso | BuscarClienteIclassResultFalha;

export type CriterioBuscaIclass = "codigo" | "nome" | "cnpj";

export function buscarClienteIclass(
  criterio: CriterioBuscaIclass,
  valor: string,
  clienteId?: number,
  geradorId?: number
): Promise<BuscarClienteIclassResult> {
  const body = {
    criterio,
    _busca: {
      iclassCodigoDireto: criterio === "codigo" ? valor : "",
      razaoSocial: criterio === "nome" ? valor : "",
      cnpj: criterio === "cnpj" ? valor : ""
    },
    gerador_id: geradorId,
    cliente_id: clienteId
  };

  return callWebhook<BuscarClienteIclassResult>(WEBHOOK_URLS.buscarClienteIclass, body, () => ({
    ok: false,
    motivo: "erro_comunicacao"
  }));
}

// ── Fluxo C.2: buscar ativo pelo número da O.S. (pra "Adicionar Gerador pelo
// número da O.S."). Webhook dedicado e ainda não criado — usa WEBHOOK_URLS.
// buscarAtivoPorOs, que é um placeholder até o link real ser enviado. ──

export interface BuscarAtivoPorOsResultSucesso extends Mockable {
  ok: true;
  ativo_id: number;
  descricao: string;
  fabricante: string;
  modelo: string;
  status_ativo: string;
  num_serie?: string;
}
export interface BuscarAtivoPorOsResultMultiplos {
  ok: true;
  multiplos: true;
  opcoes: { ativo_id: number; descricao: string }[];
}
export interface BuscarAtivoPorOsResultFalha {
  ok: false;
  motivo: string;
}
export type BuscarAtivoPorOsResult =
  | BuscarAtivoPorOsResultSucesso
  | BuscarAtivoPorOsResultMultiplos
  | BuscarAtivoPorOsResultFalha;

export function buscarAtivoPorOs(codigoOs: string): Promise<BuscarAtivoPorOsResult> {
  return callWebhook<BuscarAtivoPorOsResult>(
    WEBHOOK_URLS.buscarAtivoPorOs,
    { codigo_os: codigoOs },
    () => ({ ok: false, motivo: "erro_comunicacao" })
  );
}

// ── Fluxo C: criar gerador ──

export interface CriarGeradorResult extends Mockable {
  ok: boolean;
  id?: number;
}

export function criarGerador(
  omieClienteId: number,
  ativoId: number,
  dados: Record<string, unknown>,
  usuario: string
): Promise<CriarGeradorResult> {
  return callRpc<CriarGeradorResult>(
    "criar_gerador",
    { p_omie_cliente_id: omieClienteId, p_ativo_id: ativoId, p_dados: dados, p_usuario: usuario },
    () => ({ ok: true, id: -Math.floor(Math.random() * 1000000) })
  );
}

// ── Criar Cliente (Omie + iClass) ──

export interface CriarClientePayload {
  razao_social: string;
  nome_fantasia: string;
  cnpj_cpf: string;
  email: string;
  telefone_ddd: string;
  telefone_numero: string;
  celular: string;
  endereco: string;
  endereco_numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  observacao: string;
  usuario: string;
}

// "completo" = tudo certo nos dois sistemas. "iclass_sem_id" = criou nos dois
// mas o fluxo não conseguiu capturar o id do iClass — tratado como sucesso,
// só com aviso pra conferir depois via "Corrigir cadastro iClass".
export interface CriarClienteCompleto extends Mockable {
  ok: true;
  status: "completo" | "iclass_sem_id";
  mensagem: string;
  codigo_integracao: string;
  codigo_cliente_omie: number;
  iclass_id: number | null;
  iclass_nome: string | null;
  iclass_codigo: string | null;
  dados: Record<string, unknown>;
  omie_ok: boolean;
  iclass_ok: boolean;
  usuario: string;
}
export interface CriarClienteIclassPendente extends Mockable {
  ok: true;
  status: "iclass_pendente";
  mensagem: string;
  codigo_cliente_omie: number;
  iclass_id: null;
  omie_ok: true;
  iclass_ok: false;
  iclass_erro: string;
  dados: Record<string, unknown>;
  usuario: string;
}
export interface CriarClienteFalhaOmie extends Mockable {
  ok: false;
  status: "falha_omie";
  mensagem: string;
  omie_erro: string;
  omie_ok: false;
}
export interface CriarClienteCamposFaltando extends Mockable {
  ok: false;
  status: "campos_faltando";
  mensagem?: string;
  faltando: string[];
}
// Sobrecarga do iClass (rate limit de 25 req/min) ou falha de comunicação
// com o webhook — nenhum dos dois sistemas chegou a ser tocado.
export interface CriarClienteRateLimitOuErro extends Mockable {
  ok: false;
  status: "rate_limit_excedido" | "erro_comunicacao";
  mensagem: string;
}
export type CriarClienteResult =
  | CriarClienteCompleto
  | CriarClienteIclassPendente
  | CriarClienteFalhaOmie
  | CriarClienteCamposFaltando
  | CriarClienteRateLimitOuErro;

export function criarCliente(payload: CriarClientePayload): Promise<CriarClienteResult> {
  return callWebhook<CriarClienteResult>(WEBHOOK_URLS.criarCliente, payload, () => ({
    ok: false,
    status: "erro_comunicacao",
    mensagem: "Não foi possível se comunicar com o servidor. Tente novamente."
  }));
}
