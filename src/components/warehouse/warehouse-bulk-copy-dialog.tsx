"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircleIcon,
  ArrowRightIcon,
  ArrowRightLeftIcon,
  CheckCircle2Icon,
  CopyIcon,
  Loader2,
  PackageIcon,
  WarehouseIcon,
} from "lucide-react";
import type { WarehouseItem } from "@/services/warehouse.service";
import { toast } from "sonner";

export interface WarehouseBulkCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetWarehouse?: WarehouseItem | null;
  warehouses: WarehouseItem[];
  onSuccess: () => void;
}

function getInitialWarehouseSelection(
  targetWarehouse: WarehouseItem | null | undefined,
  warehouses: WarehouseItem[]
): { sourceId: string; targetId: string } {
  if (targetWarehouse) {
    if ((targetWarehouse.productsCount ?? 0) > 0) {
      // Warehouse has products -> Default as SOURCE
      const other = warehouses.find((w) => w.id !== targetWarehouse.id);
      return {
        sourceId: targetWarehouse.id,
        targetId: other ? other.id : "",
      };
    } else {
      // Warehouse has 0 products -> Default as TARGET
      const bestSource = [...warehouses]
        .filter((w) => w.id !== targetWarehouse.id)
        .sort((a, b) => (b.productsCount ?? 0) - (a.productsCount ?? 0))[0];
      return {
        sourceId: bestSource ? bestSource.id : "",
        targetId: targetWarehouse.id,
      };
    }
  }

  // No initial warehouse provided
  const sorted = [...warehouses].sort(
    (a, b) => (b.productsCount ?? 0) - (a.productsCount ?? 0)
  );
  const source = sorted[0];
  const target = sorted.find((w) => w.id !== source?.id);
  return {
    sourceId: source ? source.id : "",
    targetId: target ? target.id : "",
  };
}

interface WarehouseBulkCopyFormProps {
  targetWarehouse?: WarehouseItem | null;
  warehouses: WarehouseItem[];
  onSuccess: () => void;
  onClose: () => void;
}

function WarehouseBulkCopyForm({
  targetWarehouse,
  warehouses,
  onSuccess,
  onClose,
}: WarehouseBulkCopyFormProps) {
  const initial = React.useMemo(
    () => getInitialWarehouseSelection(targetWarehouse, warehouses),
    [targetWarehouse, warehouses]
  );

  const [sourceWarehouseId, setSourceWarehouseId] = React.useState<string>(initial.sourceId);
  const [targetWarehouseId, setTargetWarehouseId] = React.useState<string>(initial.targetId);
  const [copyStockQuantity, setCopyStockQuantity] = React.useState<boolean>(false);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const sourceWh = warehouses.find((w) => w.id === sourceWarehouseId);
  const targetWh = warehouses.find((w) => w.id === targetWarehouseId);

  const handleSwap = () => {
    setSourceWarehouseId(targetWarehouseId);
    setTargetWarehouseId(sourceWarehouseId);
    setError(null);
  };

  const isSameWarehouse =
    Boolean(sourceWarehouseId) &&
    Boolean(targetWarehouseId) &&
    sourceWarehouseId === targetWarehouseId;

  const sourceHasNoProducts = (sourceWh?.productsCount ?? 0) === 0;

  const isFormValid =
    Boolean(sourceWarehouseId) &&
    Boolean(targetWarehouseId) &&
    !isSameWarehouse &&
    !sourceHasNoProducts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceWarehouseId) {
      setError("Silakan pilih gudang sumber.");
      return;
    }

    if (!targetWarehouseId) {
      setError("Silakan pilih gudang tujuan.");
      return;
    }

    if (sourceWarehouseId === targetWarehouseId) {
      setError("Gudang sumber dan gudang tujuan tidak boleh sama.");
      return;
    }

    if (sourceHasNoProducts) {
      setError("Gudang sumber tidak memiliki varian produk untuk disalin.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/warehouses/${targetWarehouseId}/bulk-copy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sourceWarehouseId,
          copyStockQuantity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyalin produk antar gudang.");
      }

      toast.success(
        data.message || `Berhasil menyalin ${data.data?.copiedCount ?? 0} produk.`
      );

      onSuccess();
      onClose();
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Terjadi kesalahan sistem.";
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Visual Source -> Target Flow Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl border bg-muted/20 p-3">
        {/* Source Display */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Gudang Sumber
          </span>
          <div className="rounded-lg border bg-background p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-xs truncate">
              <WarehouseIcon className="size-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{sourceWh?.name || "-"}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <PackageIcon className="size-3" />
              <span>{sourceWh?.productsCount ?? 0} varian produk</span>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center my-1 sm:my-0">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full shadow-xs hover:bg-primary/10 hover:text-primary transition-all"
            title="Tukar Gudang Sumber & Tujuan"
            onClick={handleSwap}
            disabled={loading || warehouses.length < 2}
          >
            <ArrowRightLeftIcon className="size-3.5" />
            <span className="sr-only">Tukar Sumber dan Tujuan</span>
          </Button>
        </div>

        {/* Target Display */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Gudang Tujuan
          </span>
          <div className="rounded-lg border bg-background p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 font-medium text-xs truncate">
              <WarehouseIcon className="size-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">{targetWh?.name || "-"}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <PackageIcon className="size-3" />
              <span>Saat ini: {targetWh?.productsCount ?? 0} varian</span>
            </div>
          </div>
        </div>
      </div>

      {/* Warehouse Dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Gudang Sumber */}
        <div className="space-y-1.5">
          <Label htmlFor="sourceWarehouseSelect" className="text-xs font-semibold">
            Pilih Gudang Sumber <span className="text-destructive">*</span>
          </Label>
          <Select
            value={sourceWarehouseId}
            onValueChange={(val) => {
              setSourceWarehouseId(val ?? "");
              setError(null);
            }}
            disabled={loading}
          >
            <SelectTrigger id="sourceWarehouseSelect" className="w-full text-xs h-9">
              <SelectValue placeholder="Pilih gudang sumber..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name}{wh.code ? ` (${wh.code})` : ""} — {wh.productsCount ?? 0} varian
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gudang Tujuan */}
        <div className="space-y-1.5">
          <Label htmlFor="targetWarehouseSelect" className="text-xs font-semibold">
            Pilih Gudang Tujuan <span className="text-destructive">*</span>
          </Label>
          <Select
            value={targetWarehouseId}
            onValueChange={(val) => {
              setTargetWarehouseId(val ?? "");
              setError(null);
            }}
            disabled={loading}
          >
            <SelectTrigger id="targetWarehouseSelect" className="w-full text-xs h-9">
              <SelectValue placeholder="Pilih gudang tujuan..." />
            </SelectTrigger>
            <SelectContent>
              {warehouses.map((wh) => (
                <SelectItem key={wh.id} value={wh.id}>
                  {wh.name}{wh.code ? ` (${wh.code})` : ""} — {wh.productsCount ?? 0} varian
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status / Warnings */}
      {isSameWarehouse && (
        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
          ⚠️ Gudang sumber dan gudang tujuan tidak boleh sama.
        </p>
      )}

      {sourceWh && sourceHasNoProducts && (
        <p className="text-xs text-destructive font-medium">
          ⚠️ Gudang sumber ({sourceWh.name}) tidak memiliki varian produk untuk disalin.
        </p>
      )}

      {sourceWh && targetWh && !isSameWarehouse && !sourceHasNoProducts && (
        <div className="rounded-lg border bg-blue-50/50 dark:bg-blue-950/20 p-2.5 text-xs text-blue-800 dark:text-blue-300 flex items-center gap-2">
          <ArrowRightIcon className="size-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <span>
            Menyalin varian produk dari <strong>{sourceWh.name}</strong> ke{" "}
            <strong>{targetWh.name}</strong>. Varian yang sudah ada di gudang tujuan akan dilewati otomatis.
          </span>
        </div>
      )}

      {/* Toggle Copy Stock Quantity */}
      <div className="rounded-lg border bg-card p-3.5 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor="copyStockToggle" className="text-xs font-semibold cursor-pointer">
              Salin Jumlah Stok
            </Label>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {copyStockQuantity
                ? "Menyalin jumlah stok dari gudang sumber ke gudang tujuan."
                : "Stok di gudang tujuan akan diinisialisasi ke 0 (Rekomendasi)."}
            </p>
          </div>
          <Switch
            id="copyStockToggle"
            checked={copyStockQuantity}
            onCheckedChange={setCopyStockQuantity}
            disabled={loading}
          />
        </div>
      </div>

      <DialogFooter className="pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          type="submit"
          disabled={loading || !isFormValid}
          className="gap-1.5"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Menyalin...</span>
            </>
          ) : (
            <>
              <CheckCircle2Icon className="size-4" />
              <span>Mulai Salin</span>
            </>
          )}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function WarehouseBulkCopyDialog({
  open,
  onOpenChange,
  targetWarehouse,
  warehouses,
  onSuccess,
}: WarehouseBulkCopyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CopyIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Salin Produk Antar Gudang
              </DialogTitle>
              <DialogDescription className="text-xs">
                Salin master ketersediaan varian produk dari gudang sumber ke gudang tujuan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {open && (
          <WarehouseBulkCopyForm
            key={`${targetWarehouse?.id ?? "none"}-${open}`}
            targetWarehouse={targetWarehouse}
            warehouses={warehouses}
            onSuccess={onSuccess}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
