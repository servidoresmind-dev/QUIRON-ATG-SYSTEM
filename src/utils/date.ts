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
