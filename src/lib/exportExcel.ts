"use client";

import * as XLSX from "xlsx";

export function exportToExcel(
  rows: Record<string, unknown>[],
  filename: string,
  watermark?: string,
) {
  // With a watermark, stamp the confidential/traceability line into A1 and
  // add the table starting at row 3 so the line travels with the file.
  let sheet: XLSX.WorkSheet;
  if (watermark) {
    sheet = XLSX.utils.aoa_to_sheet([[watermark]]);
    XLSX.utils.sheet_add_json(sheet, rows, { origin: "A3" });
  } else {
    sheet = XLSX.utils.json_to_sheet(rows);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}
