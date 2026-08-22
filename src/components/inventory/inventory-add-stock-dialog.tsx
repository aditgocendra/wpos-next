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
  onSuccess: () => void;
}

export function InventoryAddStockDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: InventoryAddStockDialogProps) {
  const [variantId, setVariantId] = React.useState("");
  const [stock, setStock] = React.useState<number | string>(1);
  const [priceCost, setPriceCost] = React.useState<number | string>(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize or reset form state when product changes
  React.useEffect(() => {
    if (product && product.variants.length > 0) {
      const firstVariant = product.variants[0];
      setVariantId(firstVariant.id);
      setStock(1);
      setPriceCost(firstVariant.priceCost);
    } else {
      setVariantId("");
      setStock(1);
      setPriceCost(0);
    }
    setError(null);
  }, [product, open]);

  // Selected variant
  const selectedVariant = React.useMemo(() => {
    if (!product) return null;
    return product.variants.find((v) => v.id === variantId) || null;
  }, [product, variantId]);

  // When variant selection changes, default priceCost to that variant's current cost
  const handleVariantChange = (newVariantId: string) => {
    setVariantId(newVariantId);
    if (product) {
      const v = product.variants.find((item) => item.id === newVariantId);
      if (v) {
        setPriceCost(v.priceCost);
      }
    }
  };

  // Live calculation of Moving Average according to PRD 4.4
  const calculationPreview = React.useMemo(() => {
    if (!product || !selectedVariant) return null;

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

    const newVariantStock = selectedVariant.stock + addedQty;

    return {
      addedQty,
      newPriceCost,
      newProductTotalStock,
      newProductAvgCost,
      newVariantStock,
    };
  }, [product, selectedVariant, stock, priceCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setError(null);

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
                  {product.name} &bull; Gudang: {product.warehouse.name}
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

            {/* Variant Selector */}
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
                          (Stok saat ini: {v.stock})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Stock Input */}
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

              {/* Price Cost Input (Default: old priceCost) */}
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

            {/* Current Variant & HPP Preview Box */}
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
                    <span className="text-muted-foreground">Stok Varian Saat Ini:</span>
                    <p className="font-semibold text-foreground">
                      {selectedVariant.stock} unit &rarr;{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {calculationPreview.newVariantStock} unit
                      </strong>
                    </p>
                  </div>

                  <div>
                    <span className="text-muted-foreground">Total Stok Produk:</span>
                    <p className="font-semibold text-foreground">
                      {product.totalStock} unit &rarr;{" "}
                      <strong className="text-green-600 dark:text-green-400">
                        {calculationPreview.newProductTotalStock} unit
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t text-foreground">
                  <div className="flex items-center gap-1.5">
                    <TrendingUpIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium">HPP Baru (Moving Average):</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                      {formatRupiah(calculationPreview.newProductAvgCost)}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      Sebelumnya: {formatRupiah(product.avgCostPrice)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading && <RefreshCwIcon className="size-4 animate-spin" />}
              <span>Tambah Stok</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
