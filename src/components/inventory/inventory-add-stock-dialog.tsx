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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  PackagePlusIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ProductItem } from "@/services/inventory.service";
import { formatRupiah } from "@/components/inventory/inventory-detail-dialog";
import { cn } from "@/lib/utils";

interface InventoryAddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
  warehouses: { id: string; name: string }[];
  onSuccess: () => void;
}

interface VariantInput {
  stock: number | string;
  priceCost: number | string;
}

export function InventoryAddStockDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onSuccess,
}: InventoryAddStockDialogProps) {
  const [warehouseId, setWarehouseId] = React.useState("");
  const [inputs, setInputs] = React.useState<Record<string, VariantInput>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (product && product.variants.length > 0) {
      const initialInputs: Record<string, VariantInput> = {};
      product.variants.forEach((v) => {
        initialInputs[v.id] = { stock: "", priceCost: v.priceCost };
      });
      setInputs(initialInputs);
      if (warehouses && warehouses.length > 0) {
        setWarehouseId(warehouses[0].id);
      }
    } else {
      setInputs({});
      setWarehouseId("");
    }
    setError(null);
  }, [product, open, warehouses]);

  const handleInputChange = (variantId: string, field: keyof VariantInput, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [variantId]: {
        ...prev[variantId],
        [field]: value,
      },
    }));
  };

  const getVariantStockInWarehouse = (vId: string, wId: string) => {
    if (!product) return 0;
    const v = product.variants.find((item) => item.id === vId);
    if (!v || !v.warehouseStocks) return 0;
    const record = v.warehouseStocks.find((ws) => ws.warehouseId === wId);
    return record ? record.stock : 0;
  };

  const getVariantCostInWarehouse = (vId: string, wId: string) => {
    if (!product) return 0;
    const v = product.variants.find((item) => item.id === vId);
    if (!v || !v.warehouseStocks) return v?.priceCost || 0;
    const record = v.warehouseStocks.find((ws) => ws.warehouseId === wId);
    return record ? (record.priceCost ?? v.priceCost) : v.priceCost;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);

    if (!warehouseId) {
      setError("Gudang wajib dipilih");
      return;
    }

    const itemsToSubmit = Object.entries(inputs)
      .map(([vId, vals]) => ({
        variantId: vId,
        stock: Math.floor(Number(vals.stock) || 0),
        priceCost: Number(vals.priceCost) || 0,
      }))
      .filter((item) => item.stock > 0);

    if (itemsToSubmit.length === 0) {
      setError("Masukkan jumlah stok minimal 1 unit untuk setidaknya salah satu varian");
      return;
    }

    // Validate costs
    for (const item of itemsToSubmit) {
      if (item.priceCost < 0) {
        setError("Harga modal tidak boleh negatif");
        return;
      }
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/${product.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          items: itemsToSubmit,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan stok");
      }

      const totalAdded = itemsToSubmit.reduce((sum, item) => sum + item.stock, 0);
      toast.success(
        `Berhasil menambah ${totalAdded} stok untuk ${itemsToSubmit.length} varian produk`
      );
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menambah stok"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
              <PackagePlusIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  Tambah Stok Produk (Bulk)
                </DialogTitle>
              </div>
              <DialogDescription className="truncate">
                {product.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="space-y-4 py-3 overflow-y-auto flex-1 px-1">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <InfoIcon className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="stock-warehouse" className="text-xs font-semibold">
                Pilih Gudang <span className="text-destructive">*</span>
              </Label>
              <Select
                value={warehouseId}
                onValueChange={(val) => {
                  if (val) setWarehouseId(val);
                }}
                disabled={loading}
              >
                <SelectTrigger id="stock-warehouse" className="w-full">
                  <SelectValue placeholder="Pilih Gudang" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2">
              <Label className="text-xs font-semibold mb-2 block">
                Daftar Varian Produk
              </Label>
              <div className="space-y-3">
                {product.variants.map((variant) => {
                  const input = inputs[variant.id] || { stock: "", priceCost: 0 };
                  const addedQty = Math.max(0, Math.floor(Number(input.stock) || 0));
                  const newPriceCost = Math.max(0, Number(input.priceCost) || 0);

                  const currentStock = getVariantStockInWarehouse(variant.id, warehouseId);
                  const currentCost = getVariantCostInWarehouse(variant.id, warehouseId);

                  const newVariantStock = currentStock + addedQty;
                  const newVariantAvgCost = newVariantStock > 0
                    ? Math.round(
                        (((currentStock * currentCost) + (addedQty * newPriceCost)) /
                          newVariantStock) *
                          100
                      ) / 100
                    : newPriceCost;

                  return (
                    <div key={variant.id} className="rounded-xl border bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{variant.variantName}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {variant.sku}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Stok di gudang: <strong className="text-foreground">{currentStock}</strong> unit
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-medium text-muted-foreground">
                            Stok Tambahan
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="h-8 text-sm"
                            value={input.stock}
                            onChange={(e) => handleInputChange(variant.id, "stock", e.target.value)}
                            disabled={loading}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-medium text-muted-foreground">
                            Harga Modal Baru (Rp)
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            className="h-8 text-sm"
                            value={input.priceCost}
                            onChange={(e) => handleInputChange(variant.id, "priceCost", e.target.value)}
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {addedQty > 0 && (
                        <div className="flex items-center justify-between border-t pt-2 mt-1">
                          <div className="text-[10px] text-muted-foreground">
                            Prediksi Stok Baru: <strong className="text-green-600 dark:text-green-400">{newVariantStock} unit</strong>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <TrendingUpIcon className="size-3 text-blue-500" />
                            Prediksi HPP (Avg): <strong className="text-foreground">{formatRupiah(newVariantAvgCost)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <RefreshCwIcon className="size-4 animate-spin" />
              ) : (
                <PackagePlusIcon className="size-4" />
              )}
              {loading ? "Menyimpan..." : "Simpan Stok Baru"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
