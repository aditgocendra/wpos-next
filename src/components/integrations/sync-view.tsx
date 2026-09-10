"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  PlayIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  CheckIcon,
  WarehouseIcon,
} from "lucide-react";

interface SyncResultItem {
  sku: string;
  name: string;
  isLinked: boolean;
  localProductName: string | null;
  syncStatus: string;
  stockAdjusted?: boolean;
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
  const [progressPercent, setProgressPercent] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [linkedCount, setLinkedCount] = useState(0);
  const [unlinkedCount, setUnlinkedCount] = useState(0);
  const [syncLogs, setSyncLogs] = useState<SyncResultItem[]>([]);

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

  const runSync = async () => {
    setIsRunning(true);
    setIsFinished(false);
    setProgressPercent(0);
    setProcessedCount(0);
    setLinkedCount(0);
    setUnlinkedCount(0);
    setSyncLogs([]);
    cancelRef.current = false;

    let currentOffset = 0;
    let jobId: string | null = null;
    let hasMore = true;
    let localProcessed = 0;
    let localLinked = 0;
    let localUnlinked = 0;
    let localStockAdjusted = 0;

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
          const errData = await res.json();
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

        batchResults.forEach((it) => {
          if (it.isLinked) localLinked++;
          else localUnlinked++;
          if (it.stockAdjusted) localStockAdjusted++;
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
        const stockInfo =
          localStockAdjusted > 0
            ? ` dan ${localStockAdjusted} stok varian berhasil disesuaikan ke Shopee`
            : "";
        toast.success(
          `Sinkronisasi Selesai! ${localProcessed} produk diproses (${localLinked} terhubung${stockInfo}).`,
          { duration: 5000 }
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
            <CardTitle className="text-sm">Progres Sinkronisasi (Client-Driven Chunking)</CardTitle>
            <span className="text-xs font-mono font-semibold">{progressPercent}%</span>
          </div>
          <CardDescription className="text-xs">
            {isRunning
              ? "Sedang memproses batch produk dari Shopee ke database lokal..."
              : isFinished
              ? "Semua data produk telah selesai disinkronisasi."
              : "Klik 'Mulai Sinkronisasi' untuk memulai tarikan produk."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
            <div
              className="bg-[#EE4D2D] h-3 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Real-time Activity Feed */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Aktivitas Terakhir ({syncLogs.length} item)
            </p>
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
                        {log.stockAdjusted && log.warehouseStock !== null && (
                          <span className="text-emerald-600 font-semibold ml-1">
                            • Stok Disinkron: {log.warehouseStock}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {log.isLinked ? (
                        <>
                          <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                            <CheckIcon className="h-3 w-3 mr-1" /> Terhubung
                          </Badge>
                          {log.stockAdjusted && (
                            <Badge className="bg-[#EE4D2D] hover:bg-[#d73211] text-white text-[10px] px-1.5 py-0">
                              Stok Disinkron
                            </Badge>
                          )}
                        </>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
