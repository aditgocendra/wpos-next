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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlusIcon,
  Trash2Icon,
  Loader2Icon,
  ArrowRightLeftIcon,
  AlertCircleIcon,
  PackageIcon,
  WarehouseIcon,
} from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";
import type { ProductItem } from "@/services/inventory.service";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface TransferItemRow {
  productId: string;
  variantId: string;
  quantity: number | "";
  maxStock: number;
}

interface TransferFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferData | null; // null = Create, object = Edit
  warehouses: WarehouseOption[];
  onSuccess: () => void;
}

export function TransferFormDialog({
  open,
  onOpenChange,
  transfer,
  warehouses,
  onSuccess,
}: TransferFormDialogProps) {
  const isEdit = !!transfer;

  const [sourceWarehouseId, setSourceWarehouseId] = React.useState<string>("");
  const [destinationWarehouseId, setDestinationWarehouseId] =
    React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [items, setItems] = React.useState<TransferItemRow[]>([
    { productId: "", variantId: "", quantity: 1, maxStock: 0 },
  ]);

  const [availableProducts, setAvailableProducts] = React.useState<
    ProductItem[]
  >([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch products for selected source warehouse
  const fetchProductsForWarehouse = React.useCallback(
    async (warehouseId: string) => {
      if (!warehouseId) {
        setAvailableProducts([]);
        return;
      }
      setLoadingProducts(true);
      try {
        const res = await fetch(`/api/inventory?warehouseId=${warehouseId}`);
        const data = await res.json();
        if (res.ok && data.products) {
          setAvailableProducts(data.products);
        } else {
          setAvailableProducts([]);
        }
      } catch {
        setAvailableProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    },
    []
  );

  // Initialize or reset state when dialog opens/closes or transfer prop changes
  React.useEffect(() => {
    if (open) {
      setError(null);
      if (transfer) {
        setSourceWarehouseId(transfer.sourceWarehouseId);
        setDestinationWarehouseId(transfer.destinationWarehouseId);
        setNotes(transfer.notes || "");

        fetchProductsForWarehouse(transfer.sourceWarehouseId).then(() => {
          setItems(
            transfer.items.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
              maxStock: 9999, // default until products load
            }))
          );
        });
      } else {
        setSourceWarehouseId("");
        setDestinationWarehouseId("");
        setNotes("");
        setAvailableProducts([]);
        setItems([{ productId: "", variantId: "", quantity: 1, maxStock: 0 }]);
      }
    }
  }, [open, transfer, fetchProductsForWarehouse]);

  // When source warehouse changes in Create mode
  const handleSourceWarehouseChange = (whId: string) => {
    setSourceWarehouseId(whId);
    if (destinationWarehouseId === whId) {
      setDestinationWarehouseId("");
    }
    // Reset items
    setItems([{ productId: "", variantId: "", quantity: 1, maxStock: 0 }]);
    fetchProductsForWarehouse(whId);
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { productId: "", variantId: "", quantity: 1, maxStock: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = availableProducts.find((p) => p.id === productId);
    let defaultVariantId = "";
    let defaultMaxStock = 0;

    const selectedVariantIdsInOtherRows = items
      .filter((_, idx) => idx !== index)
      .map((r) => r.variantId)
      .filter(Boolean);

    if (selectedProd && selectedProd.variants.length > 0) {
      // Find unselected variants for this product
      const unselectedVariants = selectedProd.variants.filter(
        (v) => !selectedVariantIdsInOtherRows.includes(v.id)
      );

      // Pick first unselected variant with stock > 0, or fallback to first unselected variant
      const availableVariant =
        unselectedVariants.find((v) => v.stock > 0) || unselectedVariants[0];

      if (availableVariant) {
        defaultVariantId = availableVariant.id;
        defaultMaxStock = availableVariant.stock;
      }
    }

    setItems((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? {
              ...row,
              productId,
              variantId: defaultVariantId,
              quantity: defaultMaxStock > 0 ? 1 : 0,
              maxStock: defaultMaxStock,
            }
          : row
      )
    );
  };

  const handleVariantChange = (index: number, variantId: string) => {
    const row = items[index];
    const selectedProd = availableProducts.find((p) => p.id === row.productId);
    const selectedVar = selectedProd?.variants.find((v) => v.id === variantId);
    const maxStock = selectedVar ? selectedVar.stock : 0;

    setItems((prev) =>
      prev.map((r, idx) =>
        idx === index
          ? {
              ...r,
              variantId,
              maxStock,
              quantity: maxStock > 0 ? Math.min(Number(r.quantity) || 1, maxStock) : 0,
            }
          : r
      )
    );
  };

  const handleQuantityChange = (index: number, val: string) => {
    const num = val === "" ? "" : Math.max(1, parseInt(val, 10) || 1);
    setItems((prev) =>
      prev.map((r, idx) => (idx === index ? { ...r, quantity: num } : r))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!sourceWarehouseId) {
      setError("Gudang asal wajib dipilih");
      return;
    }
    if (!destinationWarehouseId) {
      setError("Gudang tujuan wajib dipilih");
      return;
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      setError("Gudang asal dan tujuan tidak boleh sama");
      return;
    }

    if (items.length === 0) {
      setError("Harap tambahkan minimal 1 item produk yang akan ditransfer");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.productId) {
        setError(`Pilih produk pada baris ke-${i + 1}`);
        return;
      }
      if (!it.variantId) {
        setError(`Pilih varian produk pada baris ke-${i + 1}`);
        return;
      }
      if (typeof it.quantity !== "number" || it.quantity <= 0) {
        setError(`Kuantitas transfer pada baris ke-${i + 1} harus lebih dari 0`);
        return;
      }
      if (it.maxStock > 0 && it.quantity > it.maxStock) {
        setError(
          `Kuantitas transfer pada baris ke-${i + 1} melebihi stok yang tersedia di gudang asal (Maksimal: ${it.maxStock})`
        );
        return;
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        sourceWarehouseId,
        destinationWarehouseId,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
          variantId: it.variantId,
          quantity: Number(it.quantity),
        })),
      };

      const url = isEdit ? `/api/transfers/${transfer.id}` : "/api/transfers";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data transfer");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate total variants available across all products in source warehouse
  const totalAvailableVariants = availableProducts.reduce(
    (sum, p) => sum + p.variants.length,
    0
  );
  const canAddMoreItems =
    Boolean(sourceWarehouseId) &&
    !loadingProducts &&
    availableProducts.length > 0 &&
    items.length < totalAvailableVariants;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[33.333vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ArrowRightLeftIcon className="size-5 text-primary" />
            <DialogTitle className="text-xl">
              {isEdit ? "Edit Stock Transfer" : "Buat Stock Transfer Baru"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isEdit
              ? "Ubah data draf permintaan transfer stok antar cabang gudang"
              : "Buat draf permintaan transfer barang dari gudang asal ke gudang tujuan"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/15 p-3 text-sm text-destructive border border-destructive/20">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Warehouse Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <WarehouseIcon className="size-4 text-amber-500" />
                Warehouse Asal <span className="text-destructive">*</span>
              </Label>
              <Select
                value={sourceWarehouseId}
                onValueChange={(val) => {
                  if (val) handleSourceWarehouseChange(val);
                }}
                disabled={isEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Gudang Asal" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <WarehouseIcon className="size-4 text-emerald-500" />
                Warehouse Tujuan <span className="text-destructive">*</span>
              </Label>
              <Select
                value={destinationWarehouseId}
                onValueChange={(val) => {
                  if (val) setDestinationWarehouseId(val);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Gudang Tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses
                    .filter((wh) => wh.id !== sourceWarehouseId)
                    .map((wh) => (
                      <SelectItem key={wh.id} value={wh.id}>
                        {wh.name} {wh.code ? `(${wh.code})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-4 rounded-xl border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <PackageIcon className="size-4 text-primary" />
                Daftar Produk & Varian Ditransfer
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                disabled={!canAddMoreItems}
                className="h-8 gap-1 text-xs"
              >
                <PlusIcon className="size-3.5" />
                Tambah Produk
              </Button>
            </div>

            {!sourceWarehouseId ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Silakan pilih <strong>Warehouse Asal</strong> terlebih dahulu untuk melihat daftar produk yang tersedia.
              </div>
            ) : loadingProducts ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Memuat produk dari gudang...
              </div>
            ) : availableProducts.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Tidak ada produk di gudang asal yang dipilih.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((row, index) => {
                  // Variant IDs selected in other rows
                  const selectedVariantIdsInOtherRows = items
                    .filter((_, idx) => idx !== index)
                    .map((r) => r.variantId)
                    .filter(Boolean);

                  // Products with at least 1 unselected variant, or currently selected product for this row
                  const selectableProducts = availableProducts.filter((p) => {
                    if (p.id === row.productId) return true;
                    return p.variants.some(
                      (v) => !selectedVariantIdsInOtherRows.includes(v.id)
                    );
                  });

                  const selectedProduct = availableProducts.find(
                    (p) => p.id === row.productId
                  );

                  // Variants of this product that are not yet selected in other rows
                  const selectableVariants = selectedProduct?.variants.filter(
                    (v) =>
                      v.id === row.variantId ||
                      !selectedVariantIdsInOtherRows.includes(v.id)
                  );

                  const selectedVariant = selectedProduct?.variants.find(
                    (v) => v.id === row.variantId
                  );
                  const isOverStock =
                    typeof row.quantity === "number" &&
                    selectedVariant &&
                    row.quantity > selectedVariant.stock;

                  return (
                    <div
                      key={index}
                      className="rounded-lg border bg-card p-3 space-y-3 shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2 border-b pb-2">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Baris Item #{index + 1}
                        </span>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveItem(index)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2Icon className="size-3.5" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        {/* Select Produk */}
                        <div className="md:col-span-4 space-y-1.5">
                          <Label className="text-xs">
                            Produk <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={row.productId}
                            onValueChange={(val) => {
                              if (val) handleProductChange(index, val);
                            }}
                          >
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue placeholder="Pilih Produk" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectableProducts.map((p) => (
                                <SelectItem
                                  key={p.id}
                                  value={p.id}
                                  className="text-xs"
                                >
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Select Variant */}
                        <div className="md:col-span-5 space-y-1.5">
                          <Label className="text-xs">
                            Variant Produk <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={row.variantId}
                            onValueChange={(val) => {
                              if (val) handleVariantChange(index, val);
                            }}
                            disabled={!row.productId}
                          >
                            <SelectTrigger className="w-full h-9 text-xs">
                              <SelectValue placeholder="Pilih Variant" />
                            </SelectTrigger>
                            <SelectContent>
                              {selectableVariants?.map((v) => {
                                const isOutOfStock = v.stock <= 0;
                                return (
                                  <SelectItem
                                    key={v.id}
                                    value={v.id}
                                    disabled={isOutOfStock}
                                    className="text-xs"
                                  >
                                    {v.variantName} (SKU: {v.sku}) - Stok: {v.stock}
                                    {isOutOfStock ? " [Habis]" : ""}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Input Jumlah Transfer */}
                        <div className="md:col-span-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">
                              Jumlah <span className="text-destructive">*</span>
                            </Label>
                            {selectedVariant && (
                              <span className="text-[11px] text-muted-foreground">
                                Tersedia: <strong>{selectedVariant.stock}</strong>
                              </span>
                            )}
                          </div>
                          <Input
                            type="number"
                            min={1}
                            max={selectedVariant ? selectedVariant.stock : undefined}
                            value={row.quantity}
                            onChange={(e) =>
                              handleQuantityChange(index, e.target.value)
                            }
                            disabled={!row.variantId || (selectedVariant && selectedVariant.stock <= 0)}
                            placeholder="Qty"
                            className={`h-9 text-xs ${
                              isOverStock ? "border-destructive focus-visible:ring-destructive" : ""
                            }`}
                          />
                        </div>
                      </div>

                      {isOverStock && (
                        <p className="text-[11px] text-destructive font-medium">
                          ⚠️ Jumlah yang ditransfer tidak boleh melebihi stok produk di gudang asal ({selectedVariant?.stock} unit).
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">
              Catatan Transfer (Opsional)
            </Label>
            <Textarea
              placeholder="Tambahkan instruksi pengiriman atau keterangan tambahan..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none text-sm"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={submitting || !sourceWarehouseId || !destinationWarehouseId}>
              {submitting ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : isEdit ? (
                "Simpan Perubahan"
              ) : (
                "Buat Transfer Order"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
