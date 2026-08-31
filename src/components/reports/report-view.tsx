"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";
import {
  CalendarIcon,
  DownloadIcon,
  SearchIcon,
  BoxesIcon,
  ReceiptIcon,
  DollarSignIcon,
  RotateCcwIcon,
  FilterIcon,
  ArrowUpDownIcon,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

import { ProductReportTable } from "./product-report-table";
import { TransactionReportTable } from "./transaction-report-table";
import { exportToExcel } from "@/lib/excel-export";
import type { ProductReportItem, TransactionReportItem } from "@/services/report.service";

import { useCategory } from "@/providers/category-provider";

interface CategoryOption {
  id: string;
  name: string;
  code: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
}

export function ReportView() {
  const [activeTab, setActiveTab] = useState<string>("products");
  const [, startTransition] = useTransition();

  // Filters State
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Options State
  const { categories } = useCategory();
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  // Data State
  const [productData, setProductData] = useState<ProductReportItem[]>([]);
  const [transactionData, setTransactionData] = useState<TransactionReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Fetch filter options (Warehouses)
  useEffect(() => {
    async function loadOptions() {
      try {
        const whRes = await fetch("/api/warehouses");
        if (whRes.ok) {
          const whJson = await whRes.json();
          if (whJson.warehouses) setWarehouses(whJson.warehouses);
        }
      } catch (err) {
        console.error("Failed to load options", err);
      }
    }

    loadOptions();
  }, []);

  const fetchReportData = useCallback(async () => {
    setLoading(true);

    const queryParams = new URLSearchParams();
    if (dateRange?.from) queryParams.set("startDate", dateRange.from.toISOString());
    if (dateRange?.to) queryParams.set("endDate", dateRange.to.toISOString());
    if (categoryId && categoryId !== "all") queryParams.set("categoryId", categoryId);
    if (warehouseId && warehouseId !== "all") queryParams.set("warehouseId", warehouseId);
    if (search.trim()) queryParams.set("search", search.trim());
    queryParams.set("sortBy", "productName");
    queryParams.set("sortOrder", sortOrder);

    const endpoint =
      activeTab === "products"
        ? `/api/reports/products?${queryParams.toString()}`
        : `/api/reports/transactions?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Gagal mengambil data report");
      const json = await res.json();
      if (activeTab === "products") {
        setProductData(json.data || []);
      } else {
        setTransactionData(json.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data laporan");
    } finally {
      setLoading(false);
    }
  }, [activeTab, dateRange, categoryId, warehouseId, search, sortOrder]);

  // Fetch Report Data based on active tab and filters
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReportData();
  }, [fetchReportData]);

  // Quick Date Presets
  const applyDatePreset = (preset: "today" | "last7" | "last30" | "thisMonth" | "all") => {
    const today = new Date();
    switch (preset) {
      case "today":
        setDateRange({ from: today, to: today });
        break;
      case "last7":
        setDateRange({ from: subDays(today, 6), to: today });
        break;
      case "last30":
        setDateRange({ from: subDays(today, 29), to: today });
        break;
      case "thisMonth":
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) });
        break;
      case "all":
        setDateRange(undefined);
        break;
    }
  };

  // Reset All Filters
  const handleResetFilters = () => {
    setDateRange(undefined);
    setCategoryId("all");
    setWarehouseId("all");
    setSearch("");
    setSortOrder("asc");
    toast.info("Filter telah di-reset");
  };

  // Handle Export to Excel
  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      const timestamp = format(new Date(), "yyyyMMdd-HHmm");

      if (activeTab === "products") {
        if (productData.length === 0) {
          toast.warning("Tidak ada data produk untuk diexport");
          return;
        }

        const exportData = productData.map((item, idx) => ({
          No: idx + 1,
          "Nama Produk": item.productName,
          Varian: item.variantName,
          SKU: item.sku,
          Kategori: item.categoryName,
          Gudang: item.warehouseName,
          "Qty Terjual": item.quantitySold,
          "Total Penjualan (Rp)": item.totalAmount,
          "Penjualan Terakhir": item.lastSaleDate
            ? format(new Date(item.lastSaleDate), "dd/MM/yyyy HH:mm")
            : "-",
        }));

        exportToExcel(exportData, `laporan-penjualan-produk-${timestamp}`, "Report Produk");
        toast.success("Laporan produk berhasil diexport ke Excel");
      } else {
        if (transactionData.length === 0) {
          toast.warning("Tidak ada data transaksi untuk diexport");
          return;
        }

        const exportData = transactionData.map((item, idx) => ({
          No: idx + 1,
          "No Transaksi": item.transactionNumber,
          "Tanggal Transaksi": format(new Date(item.createdAt), "dd/MM/yyyy HH:mm"),
          Gudang: item.warehouseName,
          "Daftar Produk": item.productNames,
          "Varian Terjual": item.variantNames,
          "Total Qty (Unit)": item.totalQuantity,
          "Total Nilai Transaksi (Rp)": item.totalAmount,
          Kasir: item.cashierName || "-",
        }));

        exportToExcel(exportData, `laporan-transaksi-penjualan-${timestamp}`, "Report Transaksi");
        toast.success("Laporan transaksi berhasil diexport ke Excel");
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal mengexport file Excel");
    } finally {
      setIsExporting(false);
    }
  };

  // Summary Metrics Calculation
  const totalRevenue =
    activeTab === "products"
      ? productData.reduce((sum, item) => sum + item.totalAmount, 0)
      : transactionData.reduce((sum, item) => sum + item.totalAmount, 0);

  const totalUnitsSold =
    activeTab === "products"
      ? productData.reduce((sum, item) => sum + item.quantitySold, 0)
      : transactionData.reduce((sum, item) => sum + item.totalQuantity, 0);

  const totalRecords =
    activeTab === "products" ? productData.length : transactionData.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Laporan Penjualan (Report)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Analisis penjualan produk, pergerakan varian, dan riwayat transaksi sistem POS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportExcel}
            disabled={isExporting || loading || totalRecords === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
          >
            <DownloadIcon className="size-4" />
            {isExporting ? "Mengekspor..." : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Penjualan</p>
              <h3 className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                Rp {totalRevenue.toLocaleString("id-ID")}
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <DollarSignIcon className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Kuantitas Terjual</p>
              <h3 className="text-xl font-bold text-primary mt-1">
                {totalUnitsSold.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-muted-foreground">unit</span>
              </h3>
            </div>
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <BoxesIcon className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {activeTab === "products" ? "Jumlah Varian Terjual" : "Jumlah Transaksi"}
              </p>
              <h3 className="text-xl font-bold text-foreground mt-1">
                {totalRecords.toLocaleString("id-ID")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {activeTab === "products" ? "varian" : "transaksi"}
                </span>
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-lg">
              <ReceiptIcon className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs & Filters */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          startTransition(() => {
            setActiveTab(val);
          });
        }}
        className="w-full space-y-4"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <TabsList className="grid w-full md:w-[360px] grid-cols-2">
            <TabsTrigger value="products" className="gap-2">
              <BoxesIcon className="size-4" />
              Report Product
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <ReceiptIcon className="size-4" />
              Report Transaction
            </TabsTrigger>
          </TabsList>

          {/* Quick presets for date */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
            <span className="text-muted-foreground mr-1 hidden sm:inline">Periode:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => applyDatePreset("today")}
            >
              Hari Ini
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => applyDatePreset("last7")}
            >
              7 Hari
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => applyDatePreset("thisMonth")}
            >
              Bulan Ini
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground"
              onClick={() => applyDatePreset("all")}
            >
              Semua Waktu
            </Button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="rounded-xl border bg-card p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground pb-1">
            <span className="flex items-center gap-1.5">
              <FilterIcon className="size-3.5" /> Filter Laporan
            </span>
            {(dateRange?.from || categoryId !== "all" || warehouseId !== "all" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2 gap-1"
              >
                <RotateCcwIcon className="size-3" /> Reset Filter
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Filter Date Range */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Rentang Tanggal
              </label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left font-normal h-9 text-xs truncate"
                    />
                  }
                >
                  <CalendarIcon className="mr-2 size-3.5 text-muted-foreground shrink-0" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} -{" "}
                        {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    <span className="text-muted-foreground">Pilih Rentang Tanggal</span>
                  )}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={(range: DateRange | undefined) => {
                      setDateRange(range);
                    }}
                    locale={idLocale}
                    numberOfMonths={1}
                  />
                  <div className="flex justify-end p-2 border-t gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setDateRange(undefined)}
                    >
                      Hapus
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Filter Category */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Kategori Produk
              </label>
              <Select
                items={[
                  { label: "Semua Kategori", value: "all" },
                  ...categories.map((c) => ({ label: c.name, value: c.id })),
                ]}
                value={categoryId}
                onValueChange={(val) => setCategoryId(val as string)}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Warehouse */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Gudang (Warehouse)
              </label>
              <Select
                items={[
                  { label: "Semua Gudang", value: "all" },
                  ...warehouses.map((w) => ({ label: w.name, value: w.id })),
                ]}
                value={warehouseId}
                onValueChange={(val) => setWarehouseId(val as string)}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <SelectValue placeholder="Semua Gudang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Gudang</SelectItem>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                {activeTab === "products" ? "Cari Nama Produk" : "Cari ID Transaksi"}
              </label>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={
                    activeTab === "products"
                      ? "Nama produk..."
                      : "ID/No transaksi..."
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-xs"
                />
              </div>
            </div>

            {/* Sort Order */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                Urutan Nama Produk
              </label>
              <Select
                items={[
                  { label: "A - Z (Menaik)", value: "asc" },
                  { label: "Z - A (Menurun)", value: "desc" },
                ]}
                value={sortOrder}
                onValueChange={(val) => setSortOrder(val as "asc" | "desc")}
              >
                <SelectTrigger className="w-full h-9 text-xs">
                  <ArrowUpDownIcon className="mr-1.5 size-3 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">A - Z (Menaik)</SelectItem>
                  <SelectItem value="desc">Z - A (Menurun)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Tab Content: Report Product */}
        <TabsContent value="products" className="space-y-4 outline-none">
          <ProductReportTable data={productData} loading={loading} />
        </TabsContent>

        {/* Tab Content: Report Transaction */}
        <TabsContent value="transactions" className="space-y-4 outline-none">
          <TransactionReportTable data={transactionData} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
