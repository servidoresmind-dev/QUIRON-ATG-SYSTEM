/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from "xlsx";

export function exportToExcel(data: any[], filename: string) {
  if (data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

  // Buffer to binary string and write file
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
