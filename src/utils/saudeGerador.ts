// Regra de saúde do gerador (Etapa 6) — função pura, sem tela e sem acesso ao banco.
//
// Entrada: os itens de preditiva do gerador, como vêm da view `vw_preditivas`
// (o `status` já é calculado pela view: ok / a_vencer / vencido / sem_data /
// nao_aplica, onde "a_vencer" = vence em até 30 dias). Esta função só agrupa e
// decide o caminho do relatório; não recalcula datas.
//
// Saída: totais, percentual de saúde, a lista de pendências e o "caminho":
//   caminho 1 → gerador em dia (Saúde 100%)
//   caminho 2 → gerador com preditiva vencida, a vencer ou sem informação
//
// O Oxicatalisador NÃO entra na conta (não tem datas); o relatório o mostra à parte.

import { Preditiva } from "../types";

export type StatusItemSaude = "ok" | "a_vencer" | "vencido" | "sem_data" | "nao_aplica";

export interface RegraSaude {
  // true  (estrita): item sem data impede o "100%" — o gerador cai no caminho 2.
  // false (branda) : item sem data não impede o 100%, mas é listado como aviso e
  //                  fica fora do cálculo do percentual.
  // Decisão de negócio: mudar só este valor muda o comportamento em todo o sistema.
  semDataImpede100: boolean;
}

export const REGRA_SAUDE: RegraSaude = { semDataImpede100: true };

export interface ItemSaude {
  nome: string;
  status: StatusItemSaude;
  dataVencimento: string | null;
  diasParaVencer: number | null;
}

export interface SaudeGerador {
  // null = o gerador não tem nenhum item de preditiva cadastrado (não dá para avaliar).
  caminho: 1 | 2 | null;
  // Percentual de itens em dia entre os considerados; null quando não há nenhum considerado.
  percentual: number | null;
  totais: {
    total: number;
    naoAplica: number;
    aplicaveis: number;
    ok: number;
    aVencer: number;
    vencidos: number;
    semData: number;
  };
  // Itens que pedem atenção, do mais urgente ao menos: vencidos (mais atrasado
  // primeiro), a vencer (mais próximo primeiro) e por fim os sem data.
  pendencias: ItemSaude[];
}

export type ItemEntrada = Pick<
  Preditiva,
  "item_nome" | "status" | "data_vencimento" | "dias_para_vencer" | "nao_aplica"
>;

// Status desconhecido ou ausente é tratado como "sem data": nunca como "em dia".
export function normalizarStatus(item: Pick<ItemEntrada, "status" | "nao_aplica">): StatusItemSaude {
  if (item.nao_aplica) return "nao_aplica";
  switch ((item.status || "").toLowerCase()) {
    case "ok":
      return "ok";
    case "a_vencer":
      return "a_vencer";
    case "vencido":
      return "vencido";
    case "nao_aplica":
      return "nao_aplica";
    default:
      return "sem_data";
  }
}

const ORDEM_PENDENCIA: Record<StatusItemSaude, number> = {
  vencido: 0,
  a_vencer: 1,
  sem_data: 2,
  ok: 3,
  nao_aplica: 4
};

export function calcularSaude(itens: ItemEntrada[], regra: RegraSaude = REGRA_SAUDE): SaudeGerador {
  const normalizados: ItemSaude[] = itens.map((i) => ({
    nome: i.item_nome,
    status: normalizarStatus(i),
    dataVencimento: i.data_vencimento,
    diasParaVencer: i.dias_para_vencer
  }));

  const contar = (s: StatusItemSaude) => normalizados.filter((i) => i.status === s).length;
  const naoAplica = contar("nao_aplica");
  const ok = contar("ok");
  const aVencer = contar("a_vencer");
  const vencidos = contar("vencido");
  const semData = contar("sem_data");
  const aplicaveis = normalizados.length - naoAplica;

  // Itens que entram no percentual. Na regra branda, "sem data" sai da conta.
  const considerados = regra.semDataImpede100 ? aplicaveis : aplicaveis - semData;
  const percentual = considerados > 0 ? Math.round((ok / considerados) * 100) : null;

  let caminho: 1 | 2 | null;
  if (normalizados.length === 0) {
    caminho = null;
  } else if (considerados > 0 && vencidos === 0 && aVencer === 0 && (!regra.semDataImpede100 || semData === 0)) {
    caminho = 1;
  } else {
    // Inclui o caso "tudo não se aplica / tudo sem data na regra branda": sem
    // nenhum item avaliável não dá para afirmar que o gerador está em dia.
    caminho = 2;
  }

  const pendencias = normalizados
    .filter((i) => i.status === "vencido" || i.status === "a_vencer" || i.status === "sem_data")
    .sort((a, b) => {
      if (ORDEM_PENDENCIA[a.status] !== ORDEM_PENDENCIA[b.status]) {
        return ORDEM_PENDENCIA[a.status] - ORDEM_PENDENCIA[b.status];
      }
      return (a.diasParaVencer ?? 0) - (b.diasParaVencer ?? 0);
    });

  return {
    caminho,
    percentual,
    totais: { total: normalizados.length, naoAplica, aplicaveis, ok, aVencer, vencidos, semData },
    pendencias
  };
}
