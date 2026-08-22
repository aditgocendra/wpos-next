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
  BoxesIcon,
  PlusIcon,
  Trash2Icon,
  RefreshCwIcon,
  Wand2Icon,
  InfoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProductItem } from "@/services/inventory.service";
import type { CategoryItem } from "@/services/category.service";
import { formatRupiah } from "@/components/inventory/inventory-detail-dialog";
import { CascadingCategorySelect } from "@/components/inventory/cascading-category-select";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface VariantFormRow {
  id?: string;
  variantName: string;
  sku: string;
  stock: number | string;
  priceCost: number | string;
  priceSell: number | string;
}

interface InventoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null; // null for Create, object for Edit
  categories: CategoryItem[];
  warehouses: WarehouseOption[];
  onSuccess: () => void;
}

export function InventoryFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  warehouses,
  onSuccess,
}: InventoryFormDialogProps) {
  const isEditing = Boolean(product);

  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [variants, setVariants] = React.useState<VariantFormRow[]>([
    {
      variantName: "Standard",
      sku: "",
      stock: 0,
      priceCost: 0,
      priceSell: 0,
    },
  ]);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize or reset form state
  React.useEffect(() => {
    if (product) {
      setName(product.name);
      setCategoryId(product.categoryId);
      setWarehouseId(product.warehouseId);
      setVariants(
        product.variants.map((v) => ({
          id: v.id,
          variantName: v.variantName,
          sku: v.sku,
          stock: v.stock,
          priceCost: v.priceCost,
          priceSell: v.priceSell,
        }))
      );
    } else {
      const firstLeafCategory =
        categories.find(
          (c) => c.childrenCount === 0 || !c.children || c.children.length === 0
        ) || categories[0];

      setName("");
      setCategoryId(firstLeafCategory ? firstLeafCategory.id : "");
      setWarehouseId(warehouses.length > 0 ? warehouses[0].id : "");
      setVariants([
        {
          variantName: "Standard",
          sku: "",
          stock: 0,
          priceCost: 0,
          priceSell: 0,
        },
      ]);
    }
    setError(null);
  }, [product, open, categories, warehouses]);

  // Selected Category Helper
  const selectedCategory = React.useMemo(() => {
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  // Real-time calculation of total stock and HPP preview
  const summary = React.useMemo(() => {
    const totalStock = variants.reduce(
      (sum, v) => sum + Math.max(0, Number(v.stock) || 0),
      0
    );

    if (totalStock > 0) {
      const totalCost = variants.reduce(
        (sum, v) =>
          sum + Math.max(0, Number(v.stock) || 0) * (Number(v.priceCost) || 0),
        0
      );
      const avgCostPrice = Math.round((totalCost / totalStock) * 100) / 100;
      return { totalStock, avgCostPrice };
    }

    const avgCostPrice =
      variants.length > 0
        ? Math.round(
            (variants.reduce((sum, v) => sum + (Number(v.priceCost) || 0), 0) /
              variants.length) *
              100
          ) / 100
        : 0;

    return { totalStock: 0, avgCostPrice };
  }, [variants]);

  // Add new variant row
  const handleAddVariant = () => {
    const nextIndex = variants.length + 1;
    const catCode = selectedCategory?.code || "CAT";
    const prodCode = name.trim()
      ? name.trim().slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "X")
      : "PRD";
    const varCode = `V0${nextIndex}`;
    const autoSku = `${catCode}-GEN-${prodCode}-${varCode}`;

    setVariants((prev) => [
      ...prev,
      {
        variantName: `Varian ${nextIndex}`,
        sku: autoSku,
        stock: 0,
        priceCost: 0,
        priceSell: 0,
      },
    ]);
  };

  // Remove variant row (cannot remove if only 1 remaining)
  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.error("1 produk wajib memiliki minimal 1 SKU / varian produk");
      return;
    }
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Update variant field
  const handleVariantChange = (
    index: number,
    field: keyof VariantFormRow,
    value: string | number
  ) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Auto-generate SKU helper
  const handleGenerateSku = (index: number) => {
    const catCode = selectedCategory?.code || "CAT";
    const prodWords = name.trim().split(/\s+/).filter(Boolean);
    const prodCode =
      prodWords.length >= 2
        ? (prodWords[0].slice(0, 2) + prodWords[1].slice(0, 2)).toUpperCase()
        : name.slice(0, 4).toUpperCase().padEnd(3, "X");
    const safeProdCode = prodCode.replace(/[^A-Z0-9]/g, "X");

    const varName = variants[index].variantName || `V0${index + 1}`;
    const safeVarCode = varName
      .trim()
      .slice(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");

    const generated = `${catCode}-GEN-${safeProdCode}-${safeVarCode}`;
    handleVariantChange(index, "sku", generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Nama produk wajib diisi");
      return;
    }

    if (!categoryId) {
      setError("Kategori produk wajib dipilih");
      return;
    }

    if (
      selectedCategory &&
      (selectedCategory.childrenCount > 0 ||
        (selectedCategory.children && selectedCategory.children.length > 0))
    ) {
      setError(
        `Kategori "${selectedCategory.name}" memiliki subkategori. Produk wajib memilih subkategori paling akhir (leaf subcategory).`
      );
      return;
    }

    if (!warehouseId) {
      setError("Gudang penyimpanan wajib dipilih");
      return;
    }

    if (variants.length === 0) {
      setError("1 produk wajib memiliki minimal 1 SKU / varian produk");
      return;
    }

    // Validate SKU format & duplication in form
    const skuSet = new Set<string>();
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const sku = v.sku.trim().toUpperCase();
      if (!sku) {
        setError(`SKU untuk varian baris #${i + 1} wajib diisi`);
        return;
      }
      if (skuSet.has(sku)) {
        setError(`SKU "${sku}" duplikat pada baris formulir`);
        return;
      }
      skuSet.add(sku);
    }

    try {
      setLoading(true);

      const payload = {
        name: trimmedName,
        categoryId,
        warehouseId,
        variants: variants.map((v) => ({
          ...(v.id ? { id: v.id } : {}),
          variantName: v.variantName.trim() || "Standard",
          sku: v.sku.trim().toUpperCase(),
          stock: Number(v.stock) || 0,
          priceCost: Number(v.priceCost) || 0,
          priceSell: Number(v.priceSell) || 0,
        })),
      };

      const url = isEditing ? `/api/inventory/${product!.id}` : "/api/inventory";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data produk");
      }

      toast.success(
        isEditing
          ? `Produk "${trimmedName}" berhasil diperbarui`
          : `Produk "${trimmedName}" berhasil dibuat`
      );

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan data"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[780px] max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BoxesIcon className="size-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {isEditing ? "Edit Produk & Varian" : "Tambah Produk Baru"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing
                    ? "Perbarui informasi produk, stok, dan daftar varian/SKU."
                    : "Tambahkan produk baru dengan minimal 1 varian (SKU) dan kalkulasi HPP otomatis."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 py-3">
            {error && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                <InfoIcon className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* General Info */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="prod-name" className="text-xs font-semibold">
                  Nama Produk <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prod-name"
                  placeholder="Contoh: Sony Wireless Earphone WF-1000XM5"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              {/* Multi-level Cascading Category Selector */}
              <div className="space-y-1.5 pt-1">
                <CascadingCategorySelect
                  categories={categories}
                  value={categoryId}
                  onChange={(leafId) => setCategoryId(leafId)}
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prod-warehouse" className="text-xs font-semibold">
                  Gudang Penyimpanan <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={warehouseId}
                  onValueChange={(val) => {
                    if (val) setWarehouseId(val);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger id="prod-warehouse" className="w-full">
                    <SelectValue placeholder="Pilih Gudang" />
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
            </div>

            {/* Live HPP & Stock Summary Box */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3.5 text-xs">
              <div>
                <span className="text-muted-foreground">Kalkulasi Total Stok: </span>
                <strong className="text-foreground font-semibold text-sm">
                  {summary.totalStock} unit
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Estimasi HPP (Moving Avg): </span>
                <strong className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                  {formatRupiah(summary.avgCostPrice)}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Total Varian: </span>
                <Badge variant="secondary" className="font-semibold text-[11px]">
                  {variants.length} Varian
                </Badge>
              </div>
            </div>

            {/* Variants Section */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold tracking-tight text-foreground flex items-center gap-1.5">
                    <span>Varian & SKU Produk</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      (Wajib minimal 1 varian)
                    </span>
                  </h4>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariant}
                  disabled={loading}
                  className="gap-1.5 text-xs h-8"
                >
                  <PlusIcon className="size-3.5" />
                  <span>Tambah Varian</span>
                </Button>
              </div>

              {/* Variant Rows List */}
              <div className="space-y-3">
                {variants.map((v, index) => (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl border bg-card/60 space-y-3 relative group shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[11px] font-medium">
                        Varian #{index + 1}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerateSku(index)}
                          className="text-[11px] h-7 gap-1 text-primary hover:text-primary"
                          title="Generate format SKU otomatis"
                        >
                          <Wand2Icon className="size-3" />
                          <span>Auto SKU</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVariant(index)}
                          disabled={variants.length <= 1 || loading}
                          className="size-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
                          title={
                            variants.length <= 1
                              ? "Minimal 1 varian wajib ada"
                              : "Hapus varian ini"
                          }
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      {/* Variant Name */}
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Nama Varian
                        </Label>
                        <Input
                          placeholder="Standard / Hitam / XL"
                          value={v.variantName}
                          onChange={(e) =>
                            handleVariantChange(index, "variantName", e.target.value)
                          }
                          disabled={loading}
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {/* SKU */}
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Kode SKU (Format: CAT-BRD-PRD-VAR)
                        </Label>
                        <Input
                          placeholder="EAR-SON-WF1-BLK"
                          value={v.sku}
                          onChange={(e) =>
                            handleVariantChange(
                              index,
                              "sku",
                              e.target.value.toUpperCase()
                            )
                          }
                          disabled={loading}
                          className="h-8 text-xs font-mono font-medium tracking-wide uppercase"
                          required
                        />
                      </div>

                      {/* Stock */}
                      <div className="sm:col-span-4 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Stok Awal (Unit)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) =>
                            handleVariantChange(index, "stock", e.target.value)
                          }
                          disabled={loading}
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {/* Price Cost (Modal) */}
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Harga Modal / Beli (HPP) Rp
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.priceCost}
                          onChange={(e) =>
                            handleVariantChange(index, "priceCost", e.target.value)
                          }
                          disabled={loading}
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {/* Price Sell (Jual) */}
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Harga Jual Rp
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.priceSell}
                          onChange={(e) =>
                            handleVariantChange(index, "priceSell", e.target.value)
                          }
                          disabled={loading}
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading && <RefreshCwIcon className="size-4 animate-spin" />}
              <span>{isEditing ? "Simpan Perubahan" : "Buat Produk"}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
