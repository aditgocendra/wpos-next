import * as XLSX from "xlsx";

export function exportToExcel(
  data: Record<string, unknown>[],
  fileName: string,
  sheetName: string = "Report"
) {
  if (!data || data.length === 0) {
    throw new Error("Tidak ada data untuk diexport");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
