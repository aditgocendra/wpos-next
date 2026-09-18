import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ShopeeOrderItemRow, ShopeeOrderSummary } from "@/services/shopee-order.service";

export interface ExportShopeeDataOptions {
  shopName: string;
  month: string;
  summary: ShopeeOrderSummary;
  items: ShopeeOrderItemRow[];
}

function formatRupiah(num: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Export data pesanan Shopee beserta summary ke berkas Excel (.xlsx)
 */
export function exportShopeeOrdersToExcel(options: ExportShopeeDataOptions) {
  const { shopName, month, summary, items } = options;

  if (!items || items.length === 0) {
    throw new Error("Tidak ada data pesanan untuk diekspor.");
  }

  // Buat array 2D untuk sheet
  const rows: (string | number)[][] = [];

  // Header Dokumen
  rows.push(["LAPORAN PESANAN SHOPEE"]);
  rows.push(["Toko", shopName]);
  rows.push(["Periode (Bulan)", month]);
  rows.push(["Tanggal Cetak", new Date().toLocaleString("id-ID")]);
  rows.push([]);

  // Blok Ringkasan Finansial (Summary)
  rows.push(["=== RINGKASAN FINANSIAL ==="]);
  rows.push(["Total Pendapatan Kotor", summary.totalPendapatanKotor]);
  rows.push(["Total HPP", summary.totalHpp]);
  rows.push(["Biaya Iklan", summary.biayaLainnya.adCost]);
  rows.push(["Biaya Operasional", summary.biayaLainnya.operationalCost]);
  rows.push(["Biaya Tak Terduga (Minus Order)", summary.biayaLainnya.unexpectedCost]);
  rows.push(["Total Biaya Lainnya", summary.totalBiayaLainnya]);
  rows.push(["Total Pendapatan (Setelah Dikurangi HPP)", summary.totalPendapatanSetelahHpp]);
  rows.push([
    "Persentase Pendapatan Bersih",
    `${summary.persentasePendapatanBersih.toFixed(2)}%`,
  ]);
  rows.push(["Jumlah Pesanan", summary.jumlahPesanan]);
  rows.push(["Pesanan Selesai", summary.pesananSelesai]);
  rows.push(["Pesanan Batal", summary.pesananBatal]);
  rows.push([]);

  // Tabel Data Pesanan
  rows.push([
    "No. Pesanan",
    "Tanggal Pesanan Dibuat",
    "Status Pesanan",
    "Alasan Pembatalan",
    "Nama Produk",
    "Nomor Referensi SKU",
    "Jumlah",
    "Pendapatan Kotor",
    "HPP / Unit",
    "HPP Total",
    "Pendapatan (Sebelum Biaya Lainnya)",
  ]);

  for (const it of items) {
    rows.push([
      it.noPesanan,
      it.tanggalPesananDibuat,
      it.statusPesanan,
      it.alasanPembatalan,
      it.namaProduk,
      it.nomorReferensiSku,
      it.jumlah,
      it.pendapatanKotor,
      it.hppPerUnit,
      it.hppTotal,
      it.pendapatanSebelumBiayaLainnya,
    ]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pesanan Shopee");

  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  XLSX.writeFile(workbook, `pesanan-shopee-${cleanShop}-${month}.xlsx`);
}

/**
 * Export data pesanan Shopee beserta summary ke berkas PDF (.pdf)
 */
export function exportShopeeOrdersToPdf(options: ExportShopeeDataOptions) {
  const { shopName, month, summary, items } = options;

  if (!items || items.length === 0) {
    throw new Error("Tidak ada data pesanan untuk diekspor.");
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Judul Laporan
  doc.setFontSize(16);
  doc.setTextColor(220, 53, 69); // Shopee reddish/orange tone
  doc.text("Laporan Pesanan Shopee & Analisis Laba", 14, 15);

  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Toko: ${shopName}  |  Periode: ${month}  |  Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 22);

  // Summary Metrics Box (menggunakan autoTable ringkas)
  const summaryBody = [
    [
      "Total Pendapatan Kotor:",
      formatRupiah(summary.totalPendapatanKotor),
      "Biaya Iklan:",
      formatRupiah(summary.biayaLainnya.adCost),
      "Jumlah Pesanan:",
      `${summary.jumlahPesanan} Pesanan`,
    ],
    [
      "Total HPP:",
      formatRupiah(summary.totalHpp),
      "Biaya Operasional:",
      formatRupiah(summary.biayaLainnya.operationalCost),
      "Pesanan Selesai:",
      `${summary.pesananSelesai} Pesanan`,
    ],
    [
      "Total Biaya Lainnya:",
      formatRupiah(summary.totalBiayaLainnya),
      "Biaya Tak Terduga:",
      formatRupiah(summary.biayaLainnya.unexpectedCost),
      "Pesanan Batal:",
      `${summary.pesananBatal} Pesanan`,
    ],
    [
      "Pendapatan Bersih Akhir:",
      formatRupiah(summary.totalPendapatanSetelahHpp),
      "Persentase Bersih / Kotor:",
      `${summary.persentasePendapatanBersih.toFixed(2)}%`,
      "Status Laba:",
      summary.totalPendapatanSetelahHpp >= 0 ? "PROFIT" : "MINUS",
    ],
  ];

  autoTable(doc, {
    startY: 26,
    body: summaryBody,
    theme: "grid",
    styles: { fontSize: 8.5, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 42, fillColor: [248, 249, 250] },
      1: { cellWidth: 45 },
      2: { fontStyle: "bold", cellWidth: 42, fillColor: [248, 249, 250] },
      3: { cellWidth: 45 },
      4: { fontStyle: "bold", cellWidth: 38, fillColor: [248, 249, 250] },
      5: { cellWidth: 40 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastTableEnd = (doc as any).lastAutoTable?.finalY || 55;

  // Data Table Utama
  const tableHeaders = [
    [
      "No. Pesanan",
      "Tanggal Dibuat",
      "Status",
      "Alasan Batal",
      "Nama Produk",
      "SKU",
      "Qty",
      "Pendapatan Kotor",
      "HPP / Unit",
      "HPP Total",
      "Pendapatan",
    ],
  ];

  const tableData = items.map((it) => [
    it.noPesanan,
    it.tanggalPesananDibuat,
    it.statusPesanan,
    it.alasanPembatalan || "-",
    it.namaProduk,
    it.nomorReferensiSku,
    it.jumlah.toString(),
    formatRupiah(it.pendapatanKotor),
    formatRupiah(it.hppPerUnit),
    formatRupiah(it.hppTotal),
    formatRupiah(it.pendapatanSebelumBiayaLainnya),
  ]);

  autoTable(doc, {
    startY: lastTableEnd + 6,
    head: tableHeaders,
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [238, 77, 45], // Shopee Orange
      textColor: 255,
      fontSize: 8,
      halign: "center",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      overflow: "linebreak",
    },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 40 },
      5: { cellWidth: 25 },
      6: { cellWidth: 10, halign: "center" },
      7: { cellWidth: 24, halign: "right" },
      8: { cellWidth: 22, halign: "right" },
      9: { cellWidth: 22, halign: "right" },
      10: { cellWidth: 24, halign: "right" },
    },
  });

  const cleanShop = shopName.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`laporan-pesanan-shopee-${cleanShop}-${month}.pdf`);
}
