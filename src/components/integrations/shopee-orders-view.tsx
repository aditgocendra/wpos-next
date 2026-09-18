"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  ShoppingBagIcon,
  RefreshCwIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  SlidersHorizontalIcon,
  PlusCircleIcon,
  ArrowUpDownIcon,
  CheckCircle2Icon,
  XCircleIcon,
  DollarSignIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  SearchIcon,
  RotateCcwIcon,
  StoreIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  ShopeeOrderItemRow,
  ShopeeOrderSummary,
} from "@/services/shopee-order.service";
import {
  exportShopeeOrdersToExcel,
  exportShopeeOrdersToPdf,
} from "@/lib/shopee-export";

interface IntegrationOption {
  id: string;
  shopId: string | null;
  platform: string;
  status: string;
  warehouse?: { name: string } | null;
}

const DEFAULT_VISIBLE_COLUMNS: Record<string, boolean> = {
  noPesanan: true,
  tanggalPesananDibuat: true,
  statusPesanan: true,
  alasanPembatalan: true,
  namaProduk: true,
  nomorReferensiSku: true,
  jumlah: true,
  pendapatanKotor: true,
  hppPerUnit: true,
  hppTotal: true,
  pendapatanSebelumBiayaLainnya: true,
};

const COLUMN_LABELS: Record<string, string> = {
  noPesanan: "No. Pesanan",
  tanggalPesananDibuat: "Tanggal Dibuat",
  statusPesanan: "Status Pesanan",
  alasanPembatalan: "Alasan Pembatalan",
  namaProduk: "Nama Produk",
  nomorReferensiSku: "Nomor Referensi SKU",
  jumlah: "Jumlah",
  pendapatanKotor: "Pendapatan Kotor",
  hppPerUnit: "HPP / Unit",
  hppTotal: "HPP Total",
  pendapatanSebelumBiayaLainnya: "Pendapatan (Sebelum Biaya)",
};

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(val || 0);
}

export function ShopeeOrdersView() {
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);

  // State Filter & Selection
  const [integrations, setIntegrations] = useState<IntegrationOption[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string>("");
  const [month, setMonth] = useState<string>(currentMonthStr);
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // State Sorting & Pagination
  const [sortBy, setSortBy] = useState<"orderStatus" | "orderCreatedAt">("orderStatus");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(10);

  // Data & Summary State
  const [items, setItems] = useState<ShopeeOrderItemRow[]>([]);
  const [summary, setSummary] = useState<ShopeeOrderSummary>({
    totalPendapatanKotor: 0,
    totalHpp: 0,
    totalBiayaLainnya: 0,
    totalPendapatanSetelahHpp: 0,
    persentasePendapatanBersih: 0,
    jumlahPesanan: 0,
    pesananSelesai: 0,
    pesananBatal: 0,
    biayaLainnya: {
      adCost: 0,
      operationalCost: 0,
      unexpectedCost: 0,
    },
  });
  const [paginationMeta, setPaginationMeta] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  // UI Control States
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(DEFAULT_VISIBLE_COLUMNS);

  // Dialog Form Tambah Biaya Lainnya
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState<boolean>(false);
  const [savingExpense, setSavingExpense] = useState<boolean>(false);
  const [adCostInput, setAdCostInput] = useState<string>("0");
  const [operationalCostInput, setOperationalCostInput] = useState<string>("0");
  const [unexpectedCostInput, setUnexpectedCostInput] = useState<string>("0");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on new search
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // 1. Fetch Daftar Toko / Integrations
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/integrations");
      const data = await res.json();
      const list: IntegrationOption[] = data.integrations || [];
      setIntegrations(list);

      // Pilih toko pertama yang aktif atau pertama di list
      if (list.length > 0) {
        const active = list.find((i) => i.status === "ACTIVE") || list[0];
        setSelectedIntegrationId(active.id);
      }
    } catch {
      toast.error("Gagal mengambil data toko Shopee.");
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  // 2. Fetch Data Pesanan Live & Summary
  const fetchOrders = useCallback(
    async (forceRefresh = false) => {
      if (!selectedIntegrationId) return;

      setLoading(true);
      try {
        const params = new URLSearchParams({
          integrationId: selectedIntegrationId,
          month: month || currentMonthStr,
          page: page.toString(),
          limit: limit.toString(),
          sortBy,
          sortOrder,
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }

        if (forceRefresh) {
          params.set("refresh", "true");
        }

        const res = await fetch(`/api/shopee/orders?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Gagal menarik data pesanan.");
        }

        setItems(data.items || []);
        if (data.summary) {
          setSummary(data.summary);
          setAdCostInput(data.summary.biayaLainnya?.adCost?.toString() || "0");
          setOperationalCostInput(data.summary.biayaLainnya?.operationalCost?.toString() || "0");
          setUnexpectedCostInput(data.summary.biayaLainnya?.unexpectedCost?.toString() || "0");
        }
        if (data.pagination) {
          setPaginationMeta(data.pagination);
        }

        if (forceRefresh) {
          toast.success("Data pesanan Shopee berhasil diperbarui.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    },
    [selectedIntegrationId, month, currentMonthStr, page, limit, sortBy, sortOrder, debouncedSearch]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Handle Reset Filter Bulan
  const handleResetMonth = () => {
    setMonth(currentMonthStr);
    setSearch("");
    setPage(1);
    toast.info(`Filter bulan direset ke bulan saat ini (${currentMonthStr})`);
  };

  // Handle Toggle Sort
  const handleSortChange = (newSortBy: "orderStatus" | "orderCreatedAt") => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(newSortBy);
      setSortOrder("asc");
    }
    setPage(1);
  };

  // Handle Toggle Column Visibility
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Current selected shop name
  const currentShopName = useMemo(() => {
    const shop = integrations.find((i) => i.id === selectedIntegrationId);
    return shop ? `Shop ID: ${shop.shopId || shop.id}` : "Shopee Store";
  }, [integrations, selectedIntegrationId]);

  // Handle Simpan Biaya Lainnya
  const handleSaveExpenses = async () => {
    if (!selectedIntegrationId) return;

    setSavingExpense(true);
    try {
      const adCost = parseFloat(adCostInput) || 0;
      const operationalCost = parseFloat(operationalCostInput) || 0;
      const unexpectedCost = parseFloat(unexpectedCostInput) || 0;

      const res = await fetch("/api/shopee/orders/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId: selectedIntegrationId,
          month,
          adCost,
          operationalCost,
          unexpectedCost,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan biaya.");

      // Update Summary secara real-time
      const totalBiayaLainnya = adCost + operationalCost + unexpectedCost;
      const totalPendapatanSetelahHpp =
        summary.totalPendapatanKotor - summary.totalHpp - totalBiayaLainnya;
      const persentasePendapatanBersih =
        summary.totalPendapatanKotor > 0
          ? (totalPendapatanSetelahHpp / summary.totalPendapatanKotor) * 100
          : 0;

      setSummary((prev) => ({
        ...prev,
        totalBiayaLainnya,
        totalPendapatanSetelahHpp,
        persentasePendapatanBersih,
        biayaLainnya: {
          adCost,
          operationalCost,
          unexpectedCost,
        },
      }));

      toast.success("Biaya lainnya berhasil disimpan dan pendapatan telah diperbarui!");
      setIsExpenseDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan biaya.");
    } finally {
      setSavingExpense(false);
    }
  };

  // Handle Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Ambil seluruh item untuk export (tanpa limit halaman kecil)
      const res = await fetch(
        `/api/shopee/orders?integrationId=${selectedIntegrationId}&month=${month}&limit=500`
      );
      const data = await res.json();
      const allItems = data.items || items;

      exportShopeeOrdersToExcel({
        shopName: currentShopName,
        month,
        summary,
        items: allItems,
      });
      toast.success("Data berhasil diekspor ke Excel (.xlsx)");
    } catch {
      toast.error("Gagal mengekspor file Excel.");
    } finally {
      setExporting(false);
    }
  };

  // Handle Export PDF
  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const res = await fetch(
        `/api/shopee/orders?integrationId=${selectedIntegrationId}&month=${month}&limit=500`
      );
      const data = await res.json();
      const allItems = data.items || items;

      exportShopeeOrdersToPdf({
        shopName: currentShopName,
        month,
        summary,
        items: allItems,
      });
      toast.success("Data berhasil diekspor ke PDF (.pdf)");
    } catch {
      toast.error("Gagal mengekspor file PDF.");
    } finally {
      setExporting(false);
    }
  };

  // Helper render status badge
  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === "COMPLETED") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-medium">
          <CheckCircle2Icon className="h-3 w-3 mr-1 inline" /> Selesai
        </Badge>
      );
    }
    if (s === "CANCELLED" || s === "IN_CANCEL" || s === "CANCELED") {
      return (
        <Badge variant="destructive" className="font-medium">
          <XCircleIcon className="h-3 w-3 mr-1 inline" /> Batal
        </Badge>
      );
    }
    if (s === "READY_TO_SHIP" || s === "PROCESSED") {
      return (
        <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-medium">
          Siap Kirim
        </Badge>
      );
    }
    if (s === "SHIPPED") {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-600 text-white font-medium">
          Dikirim
        </Badge>
      );
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Filter Bar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingBagIcon className="h-7 w-7 text-primary" />
            Pesanan (Shopee)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pantau transaksi Shopee secara real-time, analisis HPP inventaris, dan laba bersih.
          </p>
        </div>

        {/* Action Buttons: Export & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(true)}
            disabled={loading || !selectedIntegrationId}
            className="h-9"
          >
            <RefreshCwIcon className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Tarik Pesanan
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || items.length === 0}
            className="h-9 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
          >
            <FileSpreadsheetIcon className="h-4 w-4 mr-1.5" />
            Excel
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting || items.length === 0}
            className="h-9 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <FileTextIcon className="h-4 w-4 mr-1.5" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filter Card: Toko & Bulan */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
            {/* Toko Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <StoreIcon className="h-3.5 w-3.5" /> Pilih Toko Shopee
              </Label>
              <Select
                value={selectedIntegrationId}
                onValueChange={(val) => {
                  setSelectedIntegrationId(val || "");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full h-9 text-sm">
                  <SelectValue placeholder="Pilih Toko" />
                </SelectTrigger>
                <SelectContent>
                  {integrations.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Tidak ada toko terhubung
                    </SelectItem>
                  ) : (
                    integrations.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        Shop ID: {item.shopId || item.id}{" "}
                        {item.warehouse?.name ? `(${item.warehouse.name})` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Bulan (YYYY-MM) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                Filter Bulan
              </Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  setMonth(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-sm"
              />
            </div>

            {/* Tombol Reset Filter */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetMonth}
                className="h-9 text-xs flex-1"
              >
                <RotateCcwIcon className="h-3.5 w-3.5 mr-1" />
                Reset Bulan
              </Button>
            </div>

            {/* Quick Search */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">
                Cari Pesanan
              </Label>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="No. Pesanan, SKU, Produk..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Pendapatan Kotor */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Total Pendapatan Kotor
              <DollarSignIcon className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(summary.totalPendapatanKotor)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Dari pesanan berstatus Selesai
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total HPP */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Total HPP
              <TrendingDownIcon className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {formatCurrency(summary.totalHpp)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Berdasarkan HPP SKU inventaris
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Total Pendapatan Bersih (Setelah Dikurangi HPP) */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <div
            className={`absolute top-0 left-0 right-0 h-1 ${
              summary.totalPendapatanSetelahHpp >= 0 ? "bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Total Pendapatan (Bersih)
              <TrendingUpIcon
                className={`h-4 w-4 ${
                  summary.totalPendapatanSetelahHpp >= 0
                    ? "text-emerald-500"
                    : "text-rose-500"
                }`}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold tracking-tight ${
                summary.totalPendapatanSetelahHpp >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatCurrency(summary.totalPendapatanSetelahHpp)}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge
                variant="outline"
                className={`text-xs font-semibold ${
                  summary.persentasePendapatanBersih >= 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                }`}
              >
                {summary.persentasePendapatanBersih.toFixed(1)}%
              </Badge>
              <span className="text-[11px] text-muted-foreground">
                Margin dari kotor
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Jumlah Pesanan */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              Jumlah Pesanan
              <PackageIconCustom className="h-4 w-4 text-purple-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {summary.jumlahPesanan} <span className="text-sm font-normal text-muted-foreground">Pesanan</span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ● Selesai: {summary.pesananSelesai}
              </span>
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                ● Batal: {summary.pesananBatal}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Table Header Controls (Tambah Biaya, Hide Field, Sorting) */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Daftar Pesanan ({paginationMeta.total} Item)
              </CardTitle>
              <CardDescription className="text-xs">
                Periode: {month} &bull; Toko: {currentShopName}
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="h-9 text-xs">
                      <ArrowUpDownIcon className="h-3.5 w-3.5 mr-1.5" />
                      Urutkan: {sortBy === "orderStatus" ? "Status" : "Tanggal"} (
                      {sortOrder === "asc" ? "Naik" : "Turun"})
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-xs">Pilih Pengurutan</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "orderStatus" && sortOrder === "asc"}
                    onClick={() => {
                      setSortBy("orderStatus");
                      setSortOrder("asc");
                    }}
                  >
                    Status Pesanan (A - Z)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "orderStatus" && sortOrder === "desc"}
                    onClick={() => {
                      setSortBy("orderStatus");
                      setSortOrder("desc");
                    }}
                  >
                    Status Pesanan (Z - A)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "orderCreatedAt" && sortOrder === "desc"}
                    onClick={() => {
                      setSortBy("orderCreatedAt");
                      setSortOrder("desc");
                    }}
                  >
                    Tanggal Dibuat (Terbaru)
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={sortBy === "orderCreatedAt" && sortOrder === "asc"}
                    onClick={() => {
                      setSortBy("orderCreatedAt");
                      setSortOrder("asc");
                    }}
                  >
                    Tanggal Dibuat (Terlama)
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Fitur Hide Field */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm" className="h-9 text-xs">
                      <SlidersHorizontalIcon className="h-3.5 w-3.5 mr-1.5" />
                      Sembunyikan Kolom
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs">Tampilkan Kolom</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {Object.keys(DEFAULT_VISIBLE_COLUMNS).map((colKey) => (
                    <DropdownMenuCheckboxItem
                      key={colKey}
                      checked={visibleColumns[colKey]}
                      onCheckedChange={() => toggleColumn(colKey)}
                      className="text-xs"
                    >
                      {COLUMN_LABELS[colKey] || colKey}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Tombol Tambah Biaya Lainnya (Kanan Atas Tabel) */}
              <Button
                size="sm"
                className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                onClick={() => setIsExpenseDialogOpen(true)}
              >
                <PlusCircleIcon className="h-4 w-4 mr-1.5" />
                Tambah Biaya Lainnya
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* 4. Tabel Pesanan */}
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  {visibleColumns.noPesanan && <TableHead className="font-semibold">No. Pesanan</TableHead>}
                  {visibleColumns.tanggalPesananDibuat && (
                    <TableHead
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => handleSortChange("orderCreatedAt")}
                    >
                      <span className="flex items-center gap-1">
                        Tanggal Dibuat
                        <ArrowUpDownIcon className="h-3 w-3 opacity-60" />
                      </span>
                    </TableHead>
                  )}
                  {visibleColumns.statusPesanan && (
                    <TableHead
                      className="font-semibold cursor-pointer select-none"
                      onClick={() => handleSortChange("orderStatus")}
                    >
                      <span className="flex items-center gap-1">
                        Status
                        <ArrowUpDownIcon className="h-3 w-3 opacity-60" />
                      </span>
                    </TableHead>
                  )}
                  {visibleColumns.alasanPembatalan && (
                    <TableHead className="font-semibold">Alasan Batal</TableHead>
                  )}
                  {visibleColumns.namaProduk && <TableHead className="font-semibold">Nama Produk</TableHead>}
                  {visibleColumns.nomorReferensiSku && (
                    <TableHead className="font-semibold">SKU</TableHead>
                  )}
                  {visibleColumns.jumlah && (
                    <TableHead className="font-semibold text-center">Jumlah</TableHead>
                  )}
                  {visibleColumns.pendapatanKotor && (
                    <TableHead className="font-semibold text-right">Pendapatan Kotor</TableHead>
                  )}
                  {visibleColumns.hppPerUnit && (
                    <TableHead className="font-semibold text-right">HPP / Unit</TableHead>
                  )}
                  {visibleColumns.hppTotal && (
                    <TableHead className="font-semibold text-right">HPP Total</TableHead>
                  )}
                  {visibleColumns.pendapatanSebelumBiayaLainnya && (
                    <TableHead className="font-semibold text-right">Pendapatan (Laba)</TableHead>
                  )}
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-36 text-center text-sm text-muted-foreground animate-pulse"
                    >
                      <RefreshCwIcon className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
                      Memuat data pesanan Shopee secara live...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-36 text-center text-sm text-muted-foreground">
                      Tidak ada pesanan ditemukan untuk filter toko dan bulan ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((it) => (
                    <TableRow key={it.id} className="text-xs hover:bg-muted/30">
                      {visibleColumns.noPesanan && (
                        <TableCell className="font-mono font-medium text-foreground">
                          {it.noPesanan}
                        </TableCell>
                      )}

                      {visibleColumns.tanggalPesananDibuat && (
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {it.tanggalPesananDibuat}
                        </TableCell>
                      )}

                      {visibleColumns.statusPesanan && (
                        <TableCell>{renderStatusBadge(it.statusPesanan)}</TableCell>
                      )}

                      {visibleColumns.alasanPembatalan && (
                        <TableCell className="max-w-[180px] truncate text-muted-foreground">
                          {it.alasanPembatalan}
                        </TableCell>
                      )}

                      {visibleColumns.namaProduk && (
                        <TableCell className="font-medium max-w-[220px] truncate text-foreground">
                          {it.namaProduk}
                        </TableCell>
                      )}

                      {visibleColumns.nomorReferensiSku && (
                        <TableCell className="font-mono text-muted-foreground">
                          {it.nomorReferensiSku}
                        </TableCell>
                      )}

                      {visibleColumns.jumlah && (
                        <TableCell className="text-center font-medium">{it.jumlah}</TableCell>
                      )}

                      {visibleColumns.pendapatanKotor && (
                        <TableCell className="text-right font-medium text-foreground">
                          {formatCurrency(it.pendapatanKotor)}
                        </TableCell>
                      )}

                      {visibleColumns.hppPerUnit && (
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(it.hppPerUnit)}
                        </TableCell>
                      )}

                      {visibleColumns.hppTotal && (
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(it.hppTotal)}
                        </TableCell>
                      )}

                      {visibleColumns.pendapatanSebelumBiayaLainnya && (
                        <TableCell
                          className={`text-right font-semibold ${
                            it.pendapatanSebelumBiayaLainnya >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {formatCurrency(it.pendapatanSebelumBiayaLainnya)}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 5. Pagination Kontrol (Bawah Tabel) */}
          <div className="p-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Baris per halaman:</span>
              <Select
                value={limit.toString()}
                onValueChange={(val) => {
                  setLimit(parseInt(val || "10", 10));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-18 text-xs">
                  <SelectValue placeholder={limit.toString()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span>
                Menampilkan{" "}
                {paginationMeta.total === 0
                  ? 0
                  : (page - 1) * limit + 1}{" "}
                - {Math.min(page * limit, paginationMeta.total)} dari{" "}
                {paginationMeta.total} data
              </span>
            </div>

            <Pagination className="w-auto mx-0">
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                    className={`h-8 px-2 text-xs ${
                      page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }`}
                  />
                </PaginationItem>

                {Array.from({ length: Math.min(5, paginationMeta.totalPages) }).map((_, idx) => {
                  let pageNum = idx + 1;
                  if (paginationMeta.totalPages > 5 && page > 3) {
                    pageNum = page - 3 + idx;
                    if (pageNum > paginationMeta.totalPages) {
                      pageNum = paginationMeta.totalPages - (4 - idx);
                    }
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNum);
                        }}
                        isActive={page === pageNum}
                        className="h-8 w-8 text-xs cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page < paginationMeta.totalPages) setPage(page + 1);
                    }}
                    className={`h-8 px-2 text-xs ${
                      page >= paginationMeta.totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* 6. Dialog Modal: Tambah Biaya Lainnya */}
      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PlusCircleIcon className="h-5 w-5 text-primary" />
              Tambah Biaya Lainnya (Periode {month})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan biaya operasional bulanan toko Shopee. Nilai ini akan otomatis mengurangi
              pendapatan bersih dan memperbarui margin persentase laba secara real-time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="adCost" className="text-xs font-semibold">
                Biaya Iklan (Rp)
              </Label>
              <Input
                id="adCost"
                type="number"
                min="0"
                placeholder="Contoh: 500000"
                value={adCostInput}
                onChange={(e) => setAdCostInput(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Total biaya Shopee Ads / iklan bersponsor selama bulan ini.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="operationalCost" className="text-xs font-semibold">
                Biaya Operasional (Rp)
              </Label>
              <Input
                id="operationalCost"
                type="number"
                min="0"
                placeholder="Contoh: 300000"
                value={operationalCostInput}
                onChange={(e) => setOperationalCostInput(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Biaya packing, bubble wrap, lakban, dan penanganan gudang.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="unexpectedCost" className="text-xs font-semibold">
                Biaya Tak Terduga / Minus Order (Rp)
              </Label>
              <Input
                id="unexpectedCost"
                type="number"
                min="0"
                placeholder="Contoh: 150000"
                value={unexpectedCostInput}
                onChange={(e) => setUnexpectedCostInput(e.target.value)}
                className="h-9 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Kerugian retur hilang, denda pengiriman, atau selisih ongkir Shopee.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsExpenseDialogOpen(false)}
              disabled={savingExpense}
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveExpenses}
              disabled={savingExpense}
            >
              {savingExpense ? "Menyimpan..." : "Simpan Biaya"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PackageIconCustom(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 9.4 7.55 4.24a1.78 1.78 0 0 0-2.5 1.55v12.42a1.78 1.78 0 0 0 2.5 1.55L16.5 14.6" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </svg>
  );
}
