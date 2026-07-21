/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum PerfilUsuario {
  ADMIN = "administrador",
  COMUM = "usuario_comum"
}

export interface Gerador {
  id: string;
  cliente_id: string;
  modelo: string;
  potencia: string; // e.g. "150 kVA"
  num_serie: string;
  fabricacao: string; // Ano de fabricação
  descricao?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  documento: string; // CPF ou CNPJ
  contato: string; // Nome do contato principal
  email: string;
  telefone: string;
  endereco: string;
  geradores: Gerador[];
  criado_em: string;
}

export interface OrdemServico {
  id: string;
  cod_os: string;
  cliente_id: string;
  processada: boolean;
  orcamento_id: string | null;
  tipo_erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Orcamento {
  id: string;
  cod_orcamento: string;
  cliente_id: string;
  processada: boolean;
  os_id: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  // null = Administrador, ou Usuário Comum criado antes desta funcionalidade
  // existir (mantém acesso total antigo, "tudo exceto Usuários").
  paginas_permitidas: string[] | null;
  ativo: boolean;
  criado_em: string;
}

export interface Produto {
  id: number;
  created_at: string;
  cod_produto: number | null;
  nome_produto: string | null;
  valor_unitario: number | null;
  categora_item: number | null; // typo intencional — igual ao banco
  CFOP: number | null;
  inativo: boolean;
}

export interface Servico {
  id: number;
  created_at: string;
  nCodServ: number | null;
  cDescricao: string | null;
  nValorDesc: number | null;
  inativo: boolean;
}

export interface GeradorFicha {
  id: number;
  os_ficha_id: string;
  ativo_id_iclass: number | null;
  equipamento_codigo_iclass: string | null;
  equipamento_descricao: string | null;
  cliente_codigo_iclass: string | null;
  cliente_codigo_omie: string | null;
  cliente_nome: string | null;
  cliente_nome_fantasia: string | null;
  cliente_razao_social: string | null;
  cliente_cnpj: string | null;
  gerador_fabricante: string | null;
  gerador_ano: string | null;
  gerador_potencia: string | null;
  gerador_tensao: string | null;
  gerador_numero_montagem: string | null;
  motor_fabricante: string | null;
  motor_modelo: string | null;
  motor_numero_serie: string | null;
  motor_oleo_baldes: string | null;
  alternador_fabricante: string | null;
  alternador_modelo: string | null;
  alternador_numero_serie: string | null;
  controlador_fabricante: string | null;
  controlador_modelo: string | null;
  bomba_injetora_possui: boolean | null;
  bomba_injetora_fabricante: string | null;
  bomba_injetora_modelo: string | null;
  bomba_injetora_numero: string | null;
  bateria_quantidade: string | null;
  bateria_capacidade: string | null;
  filtro_combustivel_prim_qtd: string | null;
  filtro_combustivel_prim_codigo: string | null;
  filtro_combustivel_prim_fabricante: string | null;
  filtro_combustivel_sec_qtd: string | null;
  filtro_combustivel_sec_codigo: string | null;
  filtro_combustivel_sec_fabricante: string | null;
  filtro_lubrificante_prim_qtd: string | null;
  filtro_lubrificante_prim_codigo: string | null;
  filtro_lubrificante_prim_fabricante: string | null;
  filtro_lubrificante_sec_qtd: string | null;
  filtro_lubrificante_sec_codigo: string | null;
  filtro_lubrificante_sec_fabricante: string | null;
  filtro_agua_prim_qtd: string | null;
  filtro_agua_prim_codigo: string | null;
  filtro_agua_prim_fabricante: string | null;
  filtro_agua_sec_qtd: string | null;
  filtro_agua_sec_codigo: string | null;
  filtro_agua_sec_fabricante: string | null;
  filtro_separador_prim_qtd: string | null;
  filtro_separador_prim_codigo: string | null;
  filtro_separador_prim_fabricante: string | null;
  filtro_separador_sec_qtd: string | null;
  filtro_separador_sec_codigo: string | null;
  filtro_separador_sec_fabricante: string | null;
  filtro_ar_prim_qtd: string | null;
  filtro_ar_prim_codigo: string | null;
  filtro_ar_prim_fabricante: string | null;
  filtro_ar_sec_qtd: string | null;
  filtro_ar_sec_codigo: string | null;
  filtro_ar_sec_fabricante: string | null;
  radiador_medidas: string | null;
  status_preenchimento: string | null;
  pendencias: string | null;
  created_at: string;
  updated_at: string;
}

export interface OmieCliente {
  nome: string;
  cnpj: string;
  cod_omie: string;
}

// ── Fluxo Cliente/Gerador (Orientação Frontend — SaaS Preditivas ATG) ──

export type EstadoClienteCard = "SEM_ICLASS" | "SEM_GERADOR" | "SEM_FICHA" | "COMPLETO" | "VALIDADO";

export interface ClienteCard {
  id: number;
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj_raw: string | null;
  cnpj_limpo: string | null;
  codigo_omie: string | null;
  iclass_id_encontrado: number | null;
  iclass_codigo_encontrado: string | null;
  status_conferencia: string | null;
  cliente_validado: boolean;
  cliente_validado_por: string | null;
  n_geradores: number;
  n_com_ativo: number;
  n_com_ficha: number;
  n_validados: number;
  primeiro_gerador: string | null;
  estado: EstadoClienteCard;
  // Mesclados a partir de omie_clientes após o fetch da view — ver Clientes.tsx
  // (a view vw_cliente_card não expõe essas duas colunas).
  inativo: boolean;
  iclass_nome: string | null;
}

export interface OmieClienteDetalhe {
  id: number;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj_raw: string | null;
  codigo_omie: string | null;
  cnpj_limpo: string | null;
  codigo_iclass_raw: string | null;
  iclass_id_encontrado: number | null;
  iclass_codigo_encontrado: string | null;
  iclass_nome: string | null;
  status_conferencia: string | null;
  observacao: string | null;
  conferido_em: string | null;
  ativoId: number | null;
  numeroSerieAtivo: string | null;
  statusativo: string | null;
  observacao_ativo: string | null;
  validado: boolean;
  validado_por: string | null;
  validado_em: string | null;
}

// Seção "achatada" — cada campo é um valor de texto simples (ex: motor, gerador).
export type FichaSecaoSimples = Record<string, string>;
// Seção "aninhada" — cada campo é, por sua vez, um sub-objeto (ex: filtros,
// mangueiras: cada item tem {qtd, codigo, fabricante} ou {metros, polegadas}).
export type FichaSecaoAninhada = Record<string, Record<string, string>>;

export interface FichaLevantamentoOutroItem {
  secao: string;
  pergunta: string;
  resposta: string;
}

export interface FichaLevantamento {
  motor?: FichaSecaoSimples;
  bateria?: FichaSecaoSimples;
  filtros?: FichaSecaoAninhada;
  gerador?: FichaSecaoSimples;
  alternador?: FichaSecaoSimples;
  mangueiras?: FichaSecaoAninhada;
  controlador?: FichaSecaoSimples;
  escapamento?: FichaSecaoSimples;
  bomba_injetora?: FichaSecaoSimples;
  // Campos do iClass que não se encaixam nas seções acima — lista, não objeto.
  outros?: FichaLevantamentoOutroItem[];
  [key: string]: FichaSecaoSimples | FichaSecaoAninhada | FichaLevantamentoOutroItem[] | undefined;
}

export interface GeradorAtg {
  id: number;
  omie_cliente_id: number;
  nome_fantasia: string | null;
  razao_social: string | null;
  cnpj_limpo: string | null;
  iclass_id_cliente: number | null;
  iclass_codigo_cliente: string | null;
  num_serie: string | null;
  num_patrimonio: string | null;
  descricao: string | null;
  fabricante: string | null;
  modelo: string | null;
  ativo_id: number | null;
  status_ativo: string | null;
  tipo_equipamento: string | null;
  observacao_ativo: string | null;
  processado_em: string | null;
  atualizado_em: string | null;
  codigo_os_ficha_levantamento: string | null;
  observacao_os_ficha_levantamento: string | null;
  checklist_pesquisa_id: number | null;
  ficha_levantamento: FichaLevantamento | null;
  checklist_status: string | null;
  checklist_processado_em: string | null;
  validado: boolean;
  validado_por: string | null;
  validado_em: string | null;
  ficha_validada_por_humano: boolean;
  ficha_validada_por: string | null;
  ficha_validada_em: string | null;
  // Arquivamento (soft delete) — ver Ajuste #5 em AJUSTES_ALISSON.md.
  arquivado: boolean;
  arquivado_por: string | null;
  arquivado_em: string | null;
}

export interface Preditiva {
  id: number;
  gerador_id: number;
  nome_fantasia: string | null;
  razao_social: string | null;
  num_serie: string | null;
  modelo: string | null;
  fabricante: string | null;
  item_codigo: string;
  item_nome: string;
  periodicidade_meses: number | null;
  ordem: number | null;
  data_realizada: string | null;
  data_vencimento: string | null;
  dias_para_vencer: number | null;
  status: string | null;
  observacao: string | null;
  editado_manual: boolean;
  atualizado_em: string | null;
}

export interface OxicatalisadorAtg {
  id?: number;
  gerador_id: number;
  possui: boolean | null;
  bitola: string | null;
}

export type PeriodType = "hoje" | "semana" | "mes" | "custom";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

// ── Log de edições (Ajuste #6 — AJUSTES_ALISSON.md) ──

export interface LogEdicao {
  id: number;
  entidade: string;
  entidade_id: number;
  acao: string;
  usuario: string;
  valor_antes: Record<string, unknown> | null;
  valor_depois: Record<string, unknown> | null;
  criado_em: string;
}
