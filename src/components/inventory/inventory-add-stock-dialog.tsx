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

interface InventoryAddStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
  warehouses: { id: string; name: string }[];
  onSuccess: () => void;
}

export function InventoryAddStockDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onSuccess,
}: InventoryAddStockDialogProps) {
  const [warehouseId, setWarehouseId] = React.useState("");
  const [variantId, setVariantId] = React.useState("");
  const [stock, setStock] = React.useState<number | string>(1);
  const [priceCost, setPriceCost] = React.useState<number | string>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (product && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      setVariantId(firstVariant.id);
      setStock(1);
      setPriceCost(firstVariant.priceCost);
      if (warehouses && warehouses.length > 0) {
        setWarehouseId(warehouses[0].id);
      }
    } else {
      setVariantId("");
      setWarehouseId("");
      setStock(1);
      setPriceCost(0);
    }
    setError(null);
  }, [product, open, warehouses]);

  const selectedVariant = React.useMemo(() => {
    if (!product) return null;
    return product.variants.find((v) => v.id === variantId) || null;
  }, [product, variantId]);

  const handleVariantChange = (newVariantId: string) => {
    setVariantId(newVariantId);
    if (product) {
      const v = product.variants.find((item) => item.id === newVariantId);
      if (v) {
        setPriceCost(v.priceCost);
      }
    }
  };

  const getVariantStockInWarehouse = (vId: string, wId: string) => {
    if (!product) return 0;
    const v = product.variants.find((item) => item.id === vId);
    if (!v || !v.warehouseStocks) return 0;
    const record = v.warehouseStocks.find((ws) => ws.warehouseId === wId);
    return record ? record.stock : 0;
  };

  const calculationPreview = React.useMemo(() => {
    if (!product || !selectedVariant || !warehouseId) return null;

    const oldProductStock = product.totalStock;
    const oldProductAvgCost = product.avgCostPrice;
    const addedQty = Math.max(0, Math.floor(Number(stock) || 0));
    const newPriceCost = Math.max(0, Number(priceCost) || 0);

    const newProductTotalStock = oldProductStock + addedQty;
    const newProductAvgCost =
      newProductTotalStock > 0
        ? Math.round(
            (((oldProductStock * oldProductAvgCost) + (addedQty * newPriceCost)) /
              newProductTotalStock) *
              100
          ) / 100
        : newPriceCost;

    const currentVariantWarehouseStock = getVariantStockInWarehouse(selectedVariant.id, warehouseId);
    const newVariantStock = currentVariantWarehouseStock + addedQty;

    return {
      addedQty,
      newPriceCost,
      newProductTotalStock,
      newProductAvgCost,
      currentVariantWarehouseStock,
      newVariantStock,
    };
  }, [product, selectedVariant, warehouseId, stock, priceCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);

    if (!warehouseId) {
      setError("Gudang wajib dipilih");
      return;
    }

    if (!variantId) {
      setError("Varian produk wajib dipilih");
      return;
    }

    const addedQty = Math.floor(Number(stock) || 0);
    if (addedQty <= 0) {
      setError("Jumlah stok tambahan harus minimal 1 unit");
      return;
    }

    const inputCost = Number(priceCost);
    if (isNaN(inputCost) || inputCost < 0) {
      setError("Harga modal harus berupa nominal valid dan tidak negatif");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/${product.id}/stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          warehouseId,
          variantId,
          stock: addedQty,
          priceCost: inputCost,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menambahkan stok");
      }

      toast.success(
        `Berhasil menambah ${addedQty} stok untuk ${selectedVariant?.variantName || "produk"}`
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
      <DialogContent className="sm:max-w-[540px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
                <PackagePlusIcon className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold tracking-tight">
                    Tambah Stok Produk
                  </DialogTitle>
                </div>
                <DialogDescription className="truncate">
                  {product.name}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <InfoIcon className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="stock-warehouse" className="text-xs font-semibold">
                Gudang <span className="text-destructive">*</span>
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

            <div className="space-y-1.5">
              <Label htmlFor="stock-variant" className="text-xs font-semibold">
                Variant Produk <span className="text-destructive">*</span>
              </Label>
              <Select
                value={variantId}
                onValueChange={(val) => {
                  if (val) handleVariantChange(val);
                }}
                disabled={loading}
              >
                <SelectTrigger id="stock-variant" className="w-full">
                  <SelectValue placeholder="Pilih Varian" />
                </SelectTrigger>
                <SelectContent>
                  {product.variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{v.variantName}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          [{v.sku}]
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (Stok Total: {v.warehouseStocks?.reduce((sum, s) => sum + s.stock, 0) || 0})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stock-qty" className="text-xs font-semibold">
                  Jumlah Stok Baru (Unit) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stock-qty"
                  type="number"
                  min="1"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={loading}
                  placeholder="Contoh: 10"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-cost" className="text-xs font-semibold">
                  Harga Modal Baru (Rp) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="stock-cost"
                  type="number"
                  min="0"
                  value={priceCost}
                  onChange={(e) => setPriceCost(e.target.value)}
                  disabled={loading}
                  placeholder="Harga modal"
                  required
                />
              </div>
            </div>

            {selectedVariant && calculationPreview && (
              <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-muted-foreground">Varian Terpilih:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold">{selectedVariant.variantName}</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedVariant.sku}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <span className="text-muted-foreground">Stok Varian Saat Ini di Gudang Terpilih:</span>
                    <p className="font-semibold text-foreground">
                      {calculationPreview.currentVariantWarehouseStock} unit &rarr;{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {calculationPreview.newVariantStock} unit
                      </strong>
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Total Stok Semua Varian:</span>
                    <p className="font-semibold text-foreground">
                      {product.totalStock} unit &rarr;{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {calculationPreview.newProductTotalStock} unit
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="border-t pt-2 mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <TrendingUpIcon className="size-3.5 text-blue-500" />
                    <span className="text-muted-foreground font-medium">HPP Baru (Moving Avg):</span>
                  </div>
                  <span className="font-bold text-sm text-foreground">
                    {formatRupiah(calculationPreview.newProductAvgCost)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
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
