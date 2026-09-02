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
  ImageIcon,
  UploadCloudIcon,
  ZoomInIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProductItem } from "@/services/inventory.service";
import type { CategoryItem } from "@/services/category.service";
import { formatRupiah } from "@/components/inventory/inventory-detail-dialog";
import { CascadingCategorySelect } from "@/components/inventory/cascading-category-select";
import { compressClientImage } from "@/lib/image-compression";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";

interface WarehouseOption {
  id: string;
  name: string;
  code?: string | null;
}

interface VariantFormRow {
  id?: string;
  variantName: string;
  sku: string;
  image?: string | null;
  previewUrl?: string | null;
  pendingFile?: File | null;
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
  userRole?: string | null;
  onSuccess: () => void;
}

export function InventoryFormDialog({
  open,
  onOpenChange,
  product,
  categories,
  warehouses,
  userRole,
  onSuccess,
}: InventoryFormDialogProps) {
  const isEditing = Boolean(product);
  const isSuperAdmin = !userRole || userRole === "SUPER_ADMIN";

  const [name, setName] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [variants, setVariants] = React.useState<VariantFormRow[]>([
    {
      variantName: "Standard",
      sku: "",
      image: null,
      previewUrl: null,
      pendingFile: null,
      stock: 0,
      priceCost: 0,
      priceSell: 0,
    },
  ]);

  const [compressingIndices, setCompressingIndices] = React.useState<Record<number, boolean>>({});
  const [zoomImage, setZoomImage] = React.useState<{ src: string; title: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize or reset form state
  React.useEffect(() => {
    if (product) {
      setName(product.name);
      setCategoryId(product.categoryId);
      setVariants(
        product.variants.map((v) => {
          const existingImg = v.image || (v.images && v.images.length > 0 ? v.images[0].image : null) || null;
          return {
            id: v.id,
            variantName: v.variantName,
            sku: v.sku,
            image: existingImg,
            previewUrl: existingImg,
            pendingFile: null,
            stock: v.warehouseStocks?.reduce((sum, s) => sum + s.stock, 0) || 0,
            priceCost: v.priceCost,
            priceSell: v.priceSell,
          };
        })
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
          image: null,
          previewUrl: null,
          pendingFile: null,
          stock: 0,
          priceCost: 0,
          priceSell: 0,
        },
      ]);
    }
    setError(null);
    setCompressingIndices({});
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
    const totalCostSum = variants.reduce((sum, v) => {
      const stock = Math.max(0, Number(v.stock) || 0);
      const cost = Math.max(0, Number(v.priceCost) || 0);
      return sum + stock * cost;
    }, 0);
    const avgCostPrice = totalStock > 0 ? totalCostSum / totalStock : 0;

    return { totalStock, avgCostPrice };
  }, [variants]);

  // Update variant field
  const handleVariantChange = (
    index: number,
    field: keyof VariantFormRow,
    value: unknown
  ) => {
    setVariants((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Add new variant row
  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      {
        variantName: "",
        sku: "",
        image: null,
        previewUrl: null,
        pendingFile: null,
        stock: 0,
        priceCost: 0,
        priceSell: 0,
      },
    ]);
  };

  // Remove variant row (cannot remove if only 1 remaining)
  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) {
      toast.error("1 produk wajib memiliki minimal 1 varian");
      return;
    }
    setVariants((prev) => {
      if (prev[index]?.previewUrl && prev[index].previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(prev[index].previewUrl!);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Auto-generate SKU helper
  const handleGenerateSku = (index: number) => {
    const catCode = selectedCategory?.code || "CAT";
    const prodName = name || "PROD";
    const safeProdCode = prodName
      .trim()
      .slice(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");

    const varName = variants[index].variantName || `V0${index + 1}`;
    const safeVarCode = varName
      .trim()
      .slice(0, 3)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "X");

    const generated = `${catCode}-GEN-${safeProdCode}-${safeVarCode}`;
    handleVariantChange(index, "sku", generated);
  };

  // Image upload and client-side compression handler
  const handleImageFileChange = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setCompressingIndices((prev) => ({ ...prev, [index]: true }));

      // 1. Client-Side compression & format conversion to WebP (< 512KB)
      toast.info("Mengompresi gambar ke WebP (<512KB)...");
      const compressedFile = await compressClientImage(file);

      // 2. Generate immediate local preview (TIDAK langsung diupload ke server agar tidak menyampah jika batal)
      const localPreviewUrl = URL.createObjectURL(compressedFile);

      setVariants((prev) => {
        const next = [...prev];
        if (next[index]?.previewUrl && next[index].previewUrl?.startsWith("blob:")) {
          URL.revokeObjectURL(next[index].previewUrl!);
        }
        next[index] = {
          ...next[index],
          previewUrl: localPreviewUrl,
          pendingFile: compressedFile,
        };
        return next;
      });

      toast.success(
        `Gambar siap (${(compressedFile.size / 1024).toFixed(0)} KB). Foto akan diunggah otomatis saat Anda menyimpan produk.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan saat mengompresi gambar"
      );
    } finally {
      setCompressingIndices((prev) => ({ ...prev, [index]: false }));
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setVariants((prev) => {
      const next = [...prev];
      if (next[index]?.previewUrl && next[index].previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(next[index].previewUrl!);
      }
      next[index] = {
        ...next[index],
        previewUrl: null,
        pendingFile: null,
        image: null,
      };
      return next;
    });
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

    if (!isEditing && !warehouseId) {
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

      // Step 1: Upload any pending compressed files only now upon actual form submission
      const uploadedVariants = await Promise.all(
        variants.map(async (v, i) => {
          let finalImageUrl = v.image || null;

          if (v.pendingFile) {
            toast.info(`Mengunggah foto varian #${i + 1} ke storage...`);
            const formData = new FormData();
            formData.append("file", v.pendingFile);

            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });

            const uploadData = await uploadRes.json();
            if (!uploadRes.ok) {
              throw new Error(
                uploadData.error || `Gagal mengunggah foto varian "${v.variantName}"`
              );
            }

            finalImageUrl = uploadData.url;
          }

          return {
            ...(v.id ? { id: v.id } : {}),
            variantName: v.variantName.trim() || "Standard",
            sku: v.sku.trim().toUpperCase(),
            image: finalImageUrl,
            stock: Number(v.stock) || 0,
            priceCost: Number(v.priceCost) || 0,
            priceSell: Number(v.priceSell) || 0,
          };
        })
      );

      // Step 2: Save to inventory database
      const payload = {
        name: trimmedName,
        categoryId,
        ...(isEditing ? {} : { warehouseId }),
        variants: uploadedVariants,
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
          : `Produk "${trimmedName}" berhasil dibuat dengan ${variants.length} varian`
      );

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan saat menyimpan produk"
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
                  Gudang Penyimpanan {isEditing ? <span className="text-muted-foreground font-normal ml-1">(Tidak dapat diubah)</span> : <span className="text-destructive">*</span>}
                </Label>
                <Select
                  value={warehouseId}
                  onValueChange={(val) => {
                    if (val) setWarehouseId(val);
                  }}
                  disabled={loading || isEditing}
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
                          Stok Awal (Unit) {isEditing && Boolean(v.id) && <span className="text-[10px] ml-1">(Terkunci)</span>}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.stock}
                          onChange={(e) =>
                            handleVariantChange(index, "stock", e.target.value)
                          }
                          disabled={loading || (isEditing && Boolean(v.id))}
                          className="h-8 text-xs"
                          required
                        />
                      </div>

                      {/* Price Cost (Modal) */}
                      <div className="sm:col-span-6 space-y-1">
                        <Label className="text-[11px] font-medium text-muted-foreground">
                          Harga Modal / Beli (HPP) Rp {isEditing && Boolean(v.id) && <span className="text-[10px] ml-1">(Otomatis via Averaging)</span>}
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={v.priceCost}
                          onChange={(e) =>
                            handleVariantChange(index, "priceCost", e.target.value)
                          }
                          disabled={loading || (isEditing && Boolean(v.id))}
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

                    {/* Variant Image Upload & Preview */}
                    <div className="pt-2.5 border-t border-border/50">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {v.previewUrl || v.image ? (
                            <div className="relative group/img size-12 rounded-lg overflow-hidden border bg-muted/40 shrink-0">
                              <Image
                                src={(v.previewUrl || v.image)!}
                                alt={v.variantName || "Variant"}
                                fill
                                unoptimized
                                sizes="48px"
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setZoomImage({
                                        src: (v.previewUrl || v.image)!,
                                        title: `${name || "Produk"} - ${v.variantName || "Varian"}`,
                                      })
                                    }
                                    className="p-1 rounded text-white hover:bg-white/20 transition-colors cursor-pointer"
                                    title="Perbesar gambar"
                                  >
                                    <ZoomInIcon className="size-3.5" />
                                  </button>
                                  {isSuperAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveImage(index)}
                                      className="p-1 rounded text-white hover:bg-destructive/80 transition-colors cursor-pointer"
                                      title="Hapus gambar"
                                    >
                                      <XIcon className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="size-12 rounded-lg border border-dashed flex flex-col items-center justify-center text-muted-foreground/50 bg-muted/10 shrink-0">
                                <ImageIcon className="size-5" />
                              </div>
                            )}

                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs font-medium text-foreground">
                                  Foto Varian <span className="text-muted-foreground font-normal text-[11px]">(Opsional)</span>
                                </Label>
                                {(v.previewUrl || v.image) && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                    {v.pendingFile ? "Siap Diunggah" : "Tersimpan"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {!isSuperAdmin
                                  ? "Hanya Super Admin yang dapat mengunggah atau mengubah foto varian."
                                  : v.previewUrl || v.image
                                  ? v.pendingFile
                                    ? "Gambar terkompresi lokal. Akan otomatis diunggah saat formulir disimpan."
                                    : "Gambar tersimpan di storage. Klik untuk melihat pratinjau atau ganti file."
                                  : "JPG, PNG, atau WebP. Otomatis dikompresi ke WebP maks 512 KB."}
                              </p>
                            </div>
                          </div>

                          {isSuperAdmin && (
                            <div>
                              <input
                                type="file"
                                id={`variant-image-${index}`}
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                className="hidden"
                                disabled={loading || compressingIndices[index]}
                                onChange={(e) => handleImageFileChange(index, e)}
                              />
                              <Label
                                htmlFor={`variant-image-${index}`}
                                className={cn(
                                  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-pointer transition-colors",
                                  compressingIndices[index]
                                    ? "opacity-60 cursor-not-allowed bg-muted"
                                    : "hover:bg-accent hover:text-accent-foreground bg-background"
                                )}
                              >
                                {compressingIndices[index] ? (
                                  <>
                                    <RefreshCwIcon className="size-3 animate-spin text-primary" />
                                    <span>Mengompresi...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloudIcon className="size-3.5 text-primary" />
                                    <span>{v.previewUrl || v.image ? "Ganti Foto" : "Unggah Foto"}</span>
                                  </>
                                )}
                              </Label>
                            </div>
                          )}
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

        {zoomImage && (
          <ImageZoomDialog
            open={Boolean(zoomImage)}
            onOpenChange={(isOpen) => {
              if (!isOpen) setZoomImage(null);
            }}
            src={zoomImage.src}
            title={zoomImage.title}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
