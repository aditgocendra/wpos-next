"use client";

import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ArrowLeftIcon,
  PlayIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  AlertCircleIcon,
  ShoppingBagIcon,
  CheckIcon,
  WarehouseIcon,
  SearchIcon,
  CheckSquareIcon,
  BoxesIcon,
} from "lucide-react";

interface SyncResultItem {
  itemId?: string;
  modelId?: string;
  sku: string;
  name: string;
  isLinked: boolean;
  variantId?: string | null;
  localProductName: string | null;
  syncStatus: string;
  stockAdjusted?: boolean;
  shopeeStock?: number;
  warehouseStock?: number | null;
}

interface SyncViewProps {
  integrationId: string;
}

export function SyncView({ integrationId }: SyncViewProps) {
  const router = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [integration, setIntegration] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // Sync state
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const [reauthorizing, setReauthorizing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [linkedCount, setLinkedCount] = useState(0);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [syncLogs, setSyncLogs] = useState<SyncResultItem[]>([]);

  // Refactor: Penampung produk dengan SKU cocok & pemilihan checkbox manual
  const [matchedProducts, setMatchedProducts] = useState<SyncResultItem[]>([]);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);
  const [isSyncingStock, setIsSyncingStock] = useState(false);
  const [syncedVariantIds, setSyncedVariantIds] = useState<Set<string>>(new Set());
  const [searchFilter, setSearchFilter] = useState("");

  const cancelRef = useRef(false);

  useEffect(() => {
    async function loadIntegration() {
      try {
        const res = await fetch("/api/shopee/integrations");
        if (!res.ok) throw new Error("Gagal mengambil data");
        const data = await res.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const target = (data.integrations || []).find((i: any) => i.id === integrationId);
        if (!target) throw new Error("Integrasi toko tidak ditemukan");
        setIntegration(target);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
      } finally {
        setLoadingInfo(false);
      }
    }
    loadIntegration();
  }, [integrationId]);

  const handleReauthorize = async () => {
    try {
      setReauthorizing(true);
      const res = await fetch("/api/shopee/auth?action=get_auth_url");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Gagal mendapatkan link otorisasi Shopee");
      }
    } catch {
      toast.error("Gagal menghubungi server otorisasi");
    } finally {
      setReauthorizing(false);
    }
  };

  const runSync = async () => {
    setIsRunning(true);
    setIsFinished(false);
    setAuthExpired(false);
    setProgressPercent(0);
    setProcessedCount(0);
    setLinkedCount(0);
    setUnlinkedCount(0);
    setSyncLogs([]);
    setMatchedProducts([]);
    setSelectedVariantIds([]);
    setSyncedVariantIds(new Set());
    cancelRef.current = false;

    let currentOffset = 0;
    let jobId: string | null = null;
    let hasMore = true;
    let localProcessed = 0;
    let localLinked = 0;
    let localUnlinked = 0;

    try {
      while (hasMore && !cancelRef.current) {
        const res: Response = await fetch("/api/shopee/sync/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            integrationId,
            offset: currentOffset,
            pageSize: 15,
            jobId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: "Gagal sinkronisasi batch" }));
          if (
            errData.authExpired ||
            res.status === 401 ||
            String(errData.error).includes("error_shop_refresh_token") ||
            String(errData.error).includes("refresh token")
          ) {
            setAuthExpired(true);
          }
          throw new Error(errData.error || "Gagal sinkronisasi batch");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any = await res.json();
        jobId = data.jobId;
        hasMore = data.hasMore;
        currentOffset = data.nextOffset;

        const batchResults: SyncResultItem[] = data.results || [];
        localProcessed += batchResults.length;
        setProcessedCount(localProcessed);

        const currentTotal = data.totalItems || localProcessed;
        setTotalItems(currentTotal);

        const percent = Math.min(
          100,
          Math.round((localProcessed / (currentTotal || 1)) * 100)
        );
        setProgressPercent(percent);

        // Kumpulkan produk yang SKU-nya cocok secara lokal
        const matchedInBatch = batchResults.filter((it) => it.isLinked && it.variantId);
        if (matchedInBatch.length > 0) {
          setMatchedProducts((prev) => {
            const existingVariantIds = new Set(prev.map((p) => p.variantId));
            const newMatched = matchedInBatch.filter(
              (p) => p.variantId && !existingVariantIds.has(p.variantId)
            );
            return [...prev, ...newMatched];
          });

          // Otomatis pilih item baru agar siap disinkronkan saat user ingin "Pilih Semua"
          setSelectedVariantIds((prev) => {
            const existingSet = new Set(prev);
            matchedInBatch.forEach((p) => {
              if (p.variantId) existingSet.add(p.variantId);
            });
            return Array.from(existingSet);
          });
        }

        batchResults.forEach((it) => {
          if (it.isLinked) localLinked++;
          else localUnlinked++;
        });

        setLinkedCount(localLinked);
        setUnlinkedCount(localUnlinked);
        setSyncLogs((prev) => [...batchResults, ...prev]);

        // Jeda 200ms per batch untuk stabilitas
        await new Promise((r) => setTimeout(r, 200));
      }

      if (!cancelRef.current) {
        setIsFinished(true);
        setProgressPercent(100);
        toast.success(
          `Sinkronisasi Selesai! ${localProcessed} produk diproses (${localLinked} varian terhubung). Silakan pilih produk di bawah untuk sinkronisasi stok ke Shopee.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      toast.error(
        `Sinkronisasi Gagal: ${err instanceof Error ? err.message : "Terjadi kesalahan saat proses sinkronisasi"}`,
        { duration: 6000 }
      );
    } finally {
      setIsRunning(false);
    }
  };

  const handleStop = () => {
    cancelRef.current = true;
    setIsRunning(false);
    toast.info("Sinkronisasi dihentikan oleh pengguna");
  };

  // Filter list produk yang cocok berdasarkan search term
  const filteredMatchedProducts = useMemo(() => {
    if (!searchFilter.trim()) return matchedProducts;
    const q = searchFilter.toLowerCase();
    return matchedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.localProductName && p.localProductName.toLowerCase().includes(q))
    );
  }, [matchedProducts, searchFilter]);

  const allFilteredSelected = useMemo(() => {
    if (filteredMatchedProducts.length === 0) return false;
    return filteredMatchedProducts.every(
      (p) => p.variantId && selectedVariantIds.includes(p.variantId)
    );
  }, [filteredMatchedProducts, selectedVariantIds]);

  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      const idsToAdd = filteredMatchedProducts
        .map((p) => p.variantId)
        .filter((id): id is string => Boolean(id));
      setSelectedVariantIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
    } else {
      const idsToRemove = new Set(
        filteredMatchedProducts.map((p) => p.variantId).filter(Boolean)
      );
      setSelectedVariantIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
    }
  };

  const handleToggleItem = (variantId: string) => {
    setSelectedVariantIds((prev) =>
      prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]
    );
  };

  const handleSyncSelectedStock = async () => {
    if (selectedVariantIds.length === 0) {
      toast.warning("Silakan centang minimal satu produk yang ingin disinkronkan stoknya.");
      return;
    }

    try {
      setIsSyncingStock(true);
      const res = await fetch("/api/shopee/sync/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantIds: selectedVariantIds,
          warehouseId: integration.warehouse?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyinkronkan stok ke Shopee");
      }

      toast.success(
        `Sukses! Stok untuk ${data.pushedCount ?? selectedVariantIds.length} varian berhasil diperbarui di Shopee.`,
        { duration: 5000 }
      );

      // Tandai item yang sudah disinkronkan
      setSyncedVariantIds((prev) => {
        const nextSet = new Set(prev);
        selectedVariantIds.forEach((id) => nextSet.add(id));
        return nextSet;
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan saat sinkronisasi stok"
      );
    } finally {
      setIsSyncingStock(false);
    }
  };

  if (loadingInfo) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Memuat info toko...</div>;
  }

  if (!integration) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-destructive">Data integrasi tidak ditemukan</p>
        <Button variant="outline" onClick={() => router.push("/integrations")}>
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/integrations")}
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" /> Kembali
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Sinkronisasi Produk (Shopee Shop: {integration.shopId})
            </h1>
            <p className="text-xs text-muted-foreground">
              Menarik daftar produk dari Shopee dan memetakan SKU ke stok gudang {integration.warehouse?.name}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button variant="destructive" size="sm" onClick={handleStop}>
              Hentikan
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={runSync}
              className="bg-[#EE4D2D] hover:bg-[#d73211] text-white"
            >
              {isFinished ? (
                <>
                  <RefreshCwIcon className="mr-1.5 h-4 w-4" /> Ulangi Sinkronisasi
                </>
              ) : (
                <>
                  <PlayIcon className="mr-1.5 h-4 w-4" /> Mulai Sinkronisasi
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Auth Expired Alert */}
      {authExpired && (
        <Card className="border-red-300 bg-red-50/80 dark:border-red-900 dark:bg-red-950/40 shadow-sm">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  Sesi Otorisasi Toko Shopee Kedaluwarsa
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Shopee menolak token otorisasi toko ini (<code>error_shop_refresh_token</code>). Masa berlaku refresh token telah habis atau tidak sesuai dengan sandbox/production. Silakan lakukan otorisasi ulang untuk memperbarui token toko.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              disabled={reauthorizing}
              onClick={handleReauthorize}
              className="bg-[#EE4D2D] hover:bg-[#d73211] text-white shrink-0 font-medium"
            >
              <ShoppingBagIcon className={`mr-2 h-4 w-4 ${reauthorizing ? "animate-spin" : ""}`} />
              {reauthorizing ? "Membuka Shopee..." : "Otorisasi Ulang Toko Ini"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Gudang Sumber</CardDescription>
            <CardTitle className="text-base flex items-center gap-1.5">
              <WarehouseIcon className="h-4 w-4 text-muted-foreground" />
              {integration.warehouse?.name}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">Produk Diproses</CardDescription>
            <CardTitle className="text-base font-mono">
              {processedCount} {totalItems > 0 ? `/ ${totalItems}` : ""}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">SKU Terhubung (Cocok)</CardDescription>
            <CardTitle className="text-base font-mono text-emerald-600 flex items-center gap-1.5">
              <CheckCircle2Icon className="h-4 w-4" />
              {linkedCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs">SKU Belum Terhubung</CardDescription>
            <CardTitle className="text-base font-mono text-amber-600 flex items-center gap-1.5">
              <AlertTriangleIcon className="h-4 w-4" />
              {unlinkedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Progress Bar Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Progres Sinkronisasi Produk</CardTitle>
            <span className="text-xs font-mono font-semibold">{progressPercent}%</span>
          </div>
          <CardDescription className="text-xs">
            {isRunning
              ? "Sedang memproses batch produk dari Shopee dan memetakan SKU ke database lokal..."
              : isFinished
              ? "Semua data produk telah selesai disinkronisasi."
              : "Klik 'Mulai Sinkronisasi' untuk memulai tarikan produk tanpa mengubah stok secara otomatis."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className="bg-[#EE4D2D] h-3 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* REFACTOR: Tabel Seleksi Manual Produk dengan Checkbox */}
      {matchedProducts.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <BoxesIcon className="h-5 w-5 text-[#EE4D2D]" />
                  <span>Pilih Produk untuk Sinkronisasi Stok</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {matchedProducts.length} SKU Cocok
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  Produk berikut memiliki SKU yang persis sama. Stok <strong>tidak</strong> langsung disinkronkan secara otomatis. Centang produk yang ingin Anda perbarui stoknya di Shopee sesuai stok gudang.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  onClick={handleSyncSelectedStock}
                  disabled={selectedVariantIds.length === 0 || isSyncingStock}
                  className="bg-[#EE4D2D] hover:bg-[#d73211] text-white shadow-sm"
                >
                  <RefreshCwIcon className={`mr-1.5 h-3.5 w-3.5 ${isSyncingStock ? "animate-spin" : ""}`} />
                  {isSyncingStock
                    ? "Menyinkronkan Stok..."
                    : `Sinkronkan Stok Terpilih (${selectedVariantIds.length})`}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Filter & Select Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="relative flex-1 max-w-sm">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari berdasarkan SKU atau nama produk..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleSelectAll(!allFilteredSelected)}
                  className="h-7 text-xs px-2"
                >
                  <CheckSquareIcon className="h-3.5 w-3.5 mr-1 text-[#EE4D2D]" />
                  {allFilteredSelected ? "Batal Pilih Semua" : "Pilih Semua"}
                </Button>
                <span>•</span>
                <span>
                  <strong className="text-foreground">{selectedVariantIds.length}</strong> dari {matchedProducts.length} dipilih
                </span>
              </div>
            </div>

            {/* Matched Products Table */}
            <div className="border rounded-md overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 sticky top-0 border-b z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">
                        <Checkbox
                          checked={allFilteredSelected}
                          onCheckedChange={(checked) => handleToggleSelectAll(Boolean(checked))}
                          aria-label="Pilih semua produk"
                        />
                      </th>
                      <th className="p-2.5 font-semibold">Produk Shopee</th>
                      <th className="p-2.5 font-semibold">SKU</th>
                      <th className="p-2.5 font-semibold">Produk Lokal</th>
                      <th className="p-2.5 font-semibold text-center">Stok Shopee</th>
                      <th className="p-2.5 font-semibold text-center">Stok Gudang</th>
                      <th className="p-2.5 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredMatchedProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">
                          {searchFilter ? "Tidak ada produk yang cocok dengan pencarian." : "Belum ada produk dengan SKU cocok."}
                        </td>
                      </tr>
                    ) : (
                      filteredMatchedProducts.map((item) => {
                        const variantId = item.variantId || "";
                        const isChecked = selectedVariantIds.includes(variantId);
                        const isSynced = syncedVariantIds.has(variantId);
                        const shopeeStock = item.shopeeStock ?? 0;
                        const whStock = item.warehouseStock ?? 0;
                        const diff = whStock - shopeeStock;

                        return (
                          <tr
                            key={variantId || item.sku}
                            className={`hover:bg-accent/40 transition-colors ${
                              isChecked ? "bg-orange-50/30 dark:bg-orange-950/10" : ""
                            }`}
                          >
                            <td className="p-2.5 text-center">
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => variantId && handleToggleItem(variantId)}
                                aria-label={`Pilih ${item.name}`}
                              />
                            </td>
                            <td className="p-2.5 font-medium max-w-[220px] truncate" title={item.name}>
                              {item.name}
                            </td>
                            <td className="p-2.5 font-mono text-[11px] text-muted-foreground">
                              {item.sku}
                            </td>
                            <td className="p-2.5 text-muted-foreground max-w-[180px] truncate" title={item.localProductName || "-"}>
                              {item.localProductName || "-"}
                            </td>
                            <td className="p-2.5 text-center font-mono font-medium">
                              {shopeeStock}
                            </td>
                            <td className="p-2.5 text-center font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              {whStock}
                            </td>
                            <td className="p-2.5 text-center">
                              {isSynced ? (
                                <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                                  ✓ Stok Disinkron
                                </Badge>
                              ) : diff !== 0 ? (
                                <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                                  Beda ({diff > 0 ? `+${diff}` : diff})
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  Stok Sama
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Activity Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Riwayat Aktivitas Pemindaian ({syncLogs.length} item)</CardTitle>
          <CardDescription className="text-xs">
            Log item yang ditarik dari Shopee dan status pemetaannya terhadap database lokal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto border rounded-md divide-y text-xs">
            {syncLogs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                Belum ada log aktivitas sinkronisasi.
              </div>
            ) : (
              syncLogs.slice(0, 50).map((log, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-medium truncate">{log.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      SKU: {log.sku}{" "}
                      {log.localProductName && `• Lokal: ${log.localProductName}`}
                      {log.warehouseStock !== undefined && log.warehouseStock !== null && (
                        <span className="text-muted-foreground ml-1">
                          • Stok Gudang: {log.warehouseStock} | Shopee: {log.shopeeStock ?? 0}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {log.isLinked ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                        <CheckIcon className="h-3 w-3 mr-1" /> Terhubung
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-amber-700 bg-amber-50">
                        SKU Baru
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
