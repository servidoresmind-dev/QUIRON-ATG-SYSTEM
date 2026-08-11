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

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
