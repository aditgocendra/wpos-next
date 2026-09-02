"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  FileTextIcon,
  Loader2Icon,
  WarehouseIcon,
  UserIcon,
  CalendarIcon,
  XCircleIcon,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { StockOpnameStatus } from "@/generated/prisma/client";

interface OpnameDetailProps {
  id: string;
}

interface OpnameDetailData {
  id: string;
  opnameNumber: string;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string | null; address: string | null };
  status: StockOpnameStatus;
  notes: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  updatedBy: { id: string; name: string | null; email: string } | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    product: { id: string; name: string };
    variantId: string;
    variant: {
      id: string;
      variantName: string;
      sku: string;
      priceCost: number;
      priceSell: number;
      images?: Array<{ image: string }>;
    };
    systemStock: number;
    actualStock: number;
    difference: number;
    notes: string | null;
  }>;
}

export function OpnameDetail({ id }: OpnameDetailProps) {
  const router = useRouter();
  const [data, setData] = React.useState<OpnameDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);

  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false);
  const [confirmCancelOpen, setConfirmCancelOpen] = React.useState(false);

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/opname/${id}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal memuat detail stock opname");
      }
      setData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleCompleteOpname = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/opname/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyelesaikan stock opname");
      }
      toast.success("Stock opname berhasil diselesaikan dan stok gudang telah disinkronkan!");
      fetchDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setActionLoading(false);
      setConfirmCompleteOpen(false);
    }
  };

  const handleCancelOpname = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/opname/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal membatalkan stock opname");
      }
      toast.success("Stock opname berhasil dibatalkan");
      fetchDetail();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setActionLoading(false);
      setConfirmCancelOpen(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: StockOpnameStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
            Selesai (Completed)
          </Badge>
        );
      case "CANCELLED":
        return (
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-border/60">
            Dibatalkan
          </Badge>
        );
      case "DRAFT":
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
            Draft (Menunggu Eksekusi)
          </Badge>
        );
    }
  };

  // Summary statistics
  const summary = React.useMemo(() => {
    if (!data) return { totalItems: 0, surplusCount: 0, shortageCount: 0, totalDifferenceValue: 0 };

    let surplusCount = 0;
    let shortageCount = 0;
    let totalDifferenceValue = 0;

    for (const item of data.items) {
      const diff = item.difference;
      if (diff > 0) surplusCount += diff;
      else if (diff < 0) shortageCount += Math.abs(diff);

      const cost = item.variant?.priceCost || 0;
      totalDifferenceValue += diff * cost;
    }

    return {
      totalItems: data.items.length,
      surplusCount,
      shortageCount,
      totalDifferenceValue,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <Loader2Icon className="size-6 animate-spin text-primary" />
        <span className="text-xs">Memuat detail stock opname...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-sm font-medium text-destructive">
          Stock opname tidak ditemukan atau Anda tidak memiliki akses.
        </p>
        <Button variant="outline" size="sm" onClick={() => router.push("/opname")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  const isDraft = data.status === "DRAFT";

  return (
    <div className="space-y-6">
      {/* Header & Back Button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/opname">
            <Button variant="outline" size="icon-sm">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {data.opnameNumber}
              </h1>
              {renderStatusBadge(data.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              Dibuat pada{" "}
              {new Date(data.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {isDraft && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmCancelOpen(true)}
              disabled={actionLoading}
              className="text-destructive hover:bg-destructive/10 text-xs gap-1.5"
            >
              <XCircleIcon className="size-3.5" />
              <span>Batalkan</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => setConfirmCompleteOpen(true)}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              <CheckCircle2Icon className="size-3.5" />
              <span>Selesaikan & Terapkan Penyesuaian</span>
            </Button>
          </div>
        )}
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Warehouse Card */}
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <WarehouseIcon className="size-3.5 text-primary" />
            <span>Gudang Audit</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            {data.warehouse?.name}
          </p>
          <p className="text-xs text-muted-foreground">
            Kode: {data.warehouse?.code || "-"} {data.warehouse?.address && `• ${data.warehouse.address}`}
          </p>
        </div>

        {/* Auditor Card */}
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <UserIcon className="size-3.5 text-primary" />
            <span>Pencatat / Auditor</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            {data.createdBy?.name || "User"}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.createdBy?.email}
          </p>
        </div>

        {/* Notes Card */}
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-2 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <FileTextIcon className="size-3.5 text-primary" />
            <span>Catatan Opname</span>
          </div>
          <p className="text-xs text-foreground line-clamp-2">
            {data.notes || "Tidak ada catatan umum."}
          </p>
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">
            Total Item Diaudit
          </span>
          <p className="text-lg font-bold text-foreground mt-0.5">
            {summary.totalItems} <span className="text-xs font-normal text-muted-foreground">Varian</span>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            Total Surplus (+ Fisik)
          </span>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            +{summary.surplusCount} <span className="text-xs font-normal text-muted-foreground">Unit</span>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
            Total Kurang (- Fisik)
          </span>
          <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            -{summary.shortageCount} <span className="text-xs font-normal text-muted-foreground">Unit</span>
          </p>
        </div>

        <div className="rounded-xl border bg-card p-3.5 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">
            Estimasi Selisih Nilai (HPP)
          </span>
          <p
            className={cn(
              "text-lg font-bold mt-0.5",
              summary.totalDifferenceValue > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : summary.totalDifferenceValue < 0
                ? "text-rose-600 dark:text-rose-400"
                : "text-foreground"
            )}
          >
            Rp {summary.totalDifferenceValue.toLocaleString("id-ID")}
          </p>
        </div>
      </div>

      {/* Items Comparison Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="text-sm font-semibold text-foreground">
            Rincian Hasil Perhitungan Stok
          </h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-12 text-center text-xs">#</TableHead>
              <TableHead className="text-xs">Produk & Varian</TableHead>
              <TableHead className="text-xs text-center">Stok Sistem</TableHead>
              <TableHead className="text-xs text-center">Stok Fisik</TableHead>
              <TableHead className="text-xs text-center">Selisih</TableHead>
              <TableHead className="text-xs text-right">HPP (Modal)</TableHead>
              <TableHead className="text-xs text-right">Selisih Nilai (Rp)</TableHead>
              <TableHead className="text-xs">Alasan / Catatan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, idx) => {
              const variantImg =
                item.variant?.images && item.variant.images.length > 0
                  ? item.variant.images[0].image
                  : null;
              const cost = item.variant?.priceCost || 0;
              const diffValue = item.difference * cost;

              return (
                <TableRow key={item.id} className="hover:bg-muted/30">
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {idx + 1}
                  </TableCell>

                  <TableCell className="text-xs">
                    <div className="flex items-center gap-2.5">
                      {variantImg ? (
                        <div className="relative size-8 rounded-md overflow-hidden border shrink-0">
                          <Image
                            src={variantImg}
                            alt={item.variant?.variantName || "Variant"}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-8 rounded-md border border-dashed flex items-center justify-center shrink-0">
                          <ImageIcon className="size-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground">
                          {item.product?.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.variant?.variantName} • <span className="font-mono">{item.variant?.sku}</span>
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center text-xs">
                    <Badge variant="outline" className="font-mono">
                      {item.systemStock}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center text-xs font-semibold">
                    {item.actualStock}
                  </TableCell>

                  <TableCell className="text-center text-xs">
                    {item.difference === 0 ? (
                      <Badge variant="secondary" className="text-[11px] bg-muted text-muted-foreground">
                        0 (Sesuai)
                      </Badge>
                    ) : item.difference > 0 ? (
                      <Badge className="text-[11px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        +{item.difference} (Lebih)
                      </Badge>
                    ) : (
                      <Badge className="text-[11px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                        {item.difference} (Kurang)
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-right text-xs">
                    Rp {cost.toLocaleString("id-ID")}
                  </TableCell>

                  <TableCell className="text-right text-xs font-semibold">
                    <span
                      className={cn(
                        diffValue > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : diffValue < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                      )}
                    >
                      {diffValue > 0 ? "+" : ""}
                      Rp {diffValue.toLocaleString("id-ID")}
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground">
                    {item.notes || "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Complete Dialog Confirmation */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Selesaikan Stock Opname?</AlertDialogTitle>
            <AlertDialogDescription>
              Stok di database gudang{" "}
              <span className="font-semibold text-foreground">
                {data.warehouse?.name}
              </span>{" "}
              akan langsung diperbarui mengikuti jumlah fisik aktual yang tertera pada dokumen ini. Status akan diubah menjadi COMPLETED dan tidak dapat diedit kembali.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCompleteOpname();
              }}
              disabled={actionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                "Ya, Selesaikan Sekarang"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Dialog Confirmation */}
      <AlertDialog open={confirmCancelOpen} onOpenChange={setConfirmCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Batalkan Stock Opname?</AlertDialogTitle>
            <AlertDialogDescription>
              Dokumen Stock Opname ini akan dibatalkan (*CANCELLED*) dan saldo fisik tidak akan diterapkan ke database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Tutup</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelOpname();
              }}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Membatalkan...
                </>
              ) : (
                "Ya, Batalkan Dokumen"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
