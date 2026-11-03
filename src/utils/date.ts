/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DateRange } from "../types";

export function isDateInRange(dateString: string, range: DateRange): boolean {
  const targetDate = new Date(dateString.split("T")[0]);
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);

  // Set time to midnight for accurate day-level comparison
  targetDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return targetDate >= start && targetDate <= end;
}

export function formatDate(dateString: string): string {
  // Datas "puras" (tipo `date` do Postgres, sem hora/fuso — ex: data de
  // preditiva realizada/vencimento) não podem passar pela conversão de fuso
  // abaixo: "2026-03-02" é interpretado como meia-noite UTC, e convertendo
  // pra hora local (Brasil, UTC-3) o dia volta pra 01/03 — sempre um dia
  // antes do que foi digitado. Nesse caso extrai os números direto da string.
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }

  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Soma meses a uma data "pura" (YYYY-MM-DD, sem hora/fuso) e devolve no mesmo
// formato — usada para sugerir o vencimento da preditiva a partir do prazo do
// item (preditiva_itens.periodicidade_meses). Clampa pro último dia do mês de
// destino quando o dia de origem não existir lá (ex: 31/01 + 1 mês = 28/02,
// nunca "03/03" — o erro clássico de somar meses direto num objeto Date).
export function somarMeses(dataISO: string, meses: number): string {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const indiceMes = mes - 1 + meses; // 0-based
  const novoAno = ano + Math.floor(indiceMes / 12);
  const novoMes = ((indiceMes % 12) + 12) % 12; // 0-based, sempre positivo
  // new Date(ano, mesSeguinte, 0) = dia 0 do mês seguinte = último dia do mês
  // de destino. Só usado pra achar esse número, nunca serializado — não sofre
  // do problema de fuso que o resto deste arquivo evita.
  const ultimoDiaDoMes = new Date(novoAno, novoMes + 1, 0).getDate();
  const diaFinal = Math.min(dia, ultimoDiaDoMes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${novoAno}-${pad(novoMes + 1)}-${pad(diaFinal)}`;
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
