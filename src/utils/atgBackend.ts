// Integração com o backend do SaaS Preditivas ATG (RPCs Supabase + webhooks n8n)
// descrito em "Orientação Frontend.md".
//
// As 3 RPCs ainda não existem no Supabase (confirmado: retornam PGRST202) e os
// webhooks n8n ainda respondem apenas com o ack assíncrono padrão do n8n
// ({"message":"Workflow was started"}), não com o contrato síncrono documentado.
// Por isso: sempre tentamos a chamada real primeiro; se o backend ainda não
// responder no formato esperado, caímos automaticamente numa resposta mockada
// para manter o fluxo testável. Assim que o backend for concluído, a troca é
// automática — nenhuma alteração de código é necessária aqui.

import { supabase } from "./supabase";
import { toast } from "sonner";

const WEBHOOK_URLS = {
  buscarAtivo: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-ativo",
  buscarOs: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-os",
  buscarClienteIclass: "https://main-n8n.1smjgn.easypanel.host/webhook/buscar-cliente-iclass"
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

async function callWebhook<T extends { ok: boolean } & Mockable>(
  url: string,
  body: unknown,
  mockResponse: () => T
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
    console.warn(`[mock] Falha ao chamar webhook "${url}" — usando resposta simulada.`, err);
  }

  if (json && typeof json === "object" && "ok" in json) {
    return json as T;
  }

  warnMocked(
    `O webhook foi disparado e o workflow do n8n iniciou, mas ele ainda não responde com o resultado da busca (só o ack padrão "Workflow was started"). Usando resposta simulada até o nó "Respond to Webhook" ser configurado.`
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  return { ...mockResponse(), _mocked: true };
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
    ok: true,
    ativo_id: Math.floor(100000000 + Math.random() * 900000000),
    descricao: "GRUPO GERADOR - MOCK (backend ainda não responde de forma síncrona)",
    fabricante: "STEMAC",
    modelo: "GR200",
    status_ativo: "ATIVO"
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
    () => ({
      ok: true,
      codigo_os: codigoOs,
      checklist_pesquisa_id: Math.floor(1000 + Math.random() * 9000),
      ficha_levantamento: {
        motor: { modelo: "", num_serie: "", fabricante: "" },
        bateria: { quantidade: "", capacidade_ah: "" },
        filtros: {},
        gerador: {},
        alternador: {},
        mangueiras: {},
        controlador: {},
        escapamento: {},
        bomba_injetora: {}
      }
    })
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
    ok: true,
    total: 1,
    encontrados: [
      {
        iclass_id: Math.floor(100000000 + Math.random() * 900000000),
        iclass_nome: "CLIENTE MOCK (backend ainda não responde de forma síncrona)",
        iclass_codigo: "CTR000000000000 Roteiro: 0",
        cnpj: ""
      }
    ]
  }));
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
