"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
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
  PlusIcon,
  SearchIcon,
  Trash2Icon,
  WarehouseIcon,
  LayersIcon,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WarehouseOption {
  id: string;
  name: string;
  code: string | null;
}

interface InventoryVariant {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  image?: string | null;
  priceCost: number;
  stock: number;
}

interface FormRowItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  image?: string | null;
  priceCost: number;
  systemStock: number;
  actualStock: number | string;
  notes: string;
}

export function OpnameForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const userWarehouseId = session?.user?.warehouseId;
  const isSuperAdmin = userRole === "SUPER_ADMIN";

  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");
  const [items, setItems] = React.useState<FormRowItem[]>([]);

  // Available catalog in selected warehouse
  const [catalog, setCatalog] = React.useState<InventoryVariant[]>([]);
  const [catalogSearch, setCatalogSearch] = React.useState("");
  const [loadingCatalog, setLoadingCatalog] = React.useState(false);
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);

  // Complete confirmation dialog
  const [confirmCompleteOpen, setConfirmCompleteOpen] = React.useState(false);

  // Fetch warehouses list
  React.useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch("/api/warehouses");
        if (res.ok) {
          const json = await res.json();
          const list: WarehouseOption[] = json.warehouses || json.data || [];
          setWarehouses(list);

          if (isSuperAdmin && list.length > 0 && !selectedWarehouseId) {
            setSelectedWarehouseId(list[0].id);
          }
        }
      } catch {
        // ignore
      }
    }

    if (isSuperAdmin) {
      loadWarehouses();
    } else if (userWarehouseId) {
      setSelectedWarehouseId(userWarehouseId);
    }
  }, [isSuperAdmin, userWarehouseId, selectedWarehouseId]);

  // Fetch all product variants in selected warehouse
  const fetchWarehouseCatalog = React.useCallback(async (warehouseId: string) => {
    if (!warehouseId) return;
    setLoadingCatalog(true);
    try {
      const res = await fetch(`/api/inventory?warehouseId=${warehouseId}&limit=500`);
      if (res.ok) {
        const json = await res.json();
        const products = json.data || [];
        const flattened: InventoryVariant[] = [];

        for (const prod of products) {
          for (const variant of prod.variants || []) {
            const whStock =
              variant.warehouseStocks?.find(
                (ws: { warehouseId: string; stock: number }) => ws.warehouseId === warehouseId
              )?.stock ??
              variant.warehouseStocks?.reduce(
                (sum: number, ws: { stock: number }) => sum + ws.stock,
                0
              ) ??
              0;

            const variantImg =
              variant.image ||
              (variant.images && variant.images.length > 0 ? variant.images[0].image : null) ||
              null;

            flattened.push({
              productId: prod.id,
              productName: prod.name,
              variantId: variant.id,
              variantName: variant.variantName,
              sku: variant.sku,
              image: variantImg,
              priceCost: variant.priceCost || 0,
              stock: whStock,
            });
          }
        }

        setCatalog(flattened);
      }
    } catch {
      toast.error("Gagal memuat katalog produk gudang");
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  React.useEffect(() => {
    if (selectedWarehouseId) {
      fetchWarehouseCatalog(selectedWarehouseId);
    }
  }, [selectedWarehouseId, fetchWarehouseCatalog]);

  // Add all variants to form
  const handleAddAllCatalog = () => {
    if (catalog.length === 0) {
      toast.info("Tidak ada varian barang di gudang ini");
      return;
    }

    const existingIds = new Set(items.map((i) => i.variantId));
    const newItems: FormRowItem[] = [];

    for (const v of catalog) {
      if (!existingIds.has(v.variantId)) {
        newItems.push({
          productId: v.productId,
          productName: v.productName,
          variantId: v.variantId,
          variantName: v.variantName,
          sku: v.sku,
          image: v.image,
          priceCost: v.priceCost,
          systemStock: v.stock,
          actualStock: v.stock, // default to current system stock
          notes: "",
        });
      }
    }

    if (newItems.length === 0) {
      toast.info("Semua barang katalog sudah dimasukkan ke dalam daftar");
      return;
    }

    setItems((prev) => [...prev, ...newItems]);
    toast.success(`Berhasil menambahkan ${newItems.length} varian barang ke tabel audit`);
  };

  // Add single variant to form
  const handleAddItem = (variant: InventoryVariant) => {
    if (items.some((i) => i.variantId === variant.variantId)) {
      toast.info(`Varian "${variant.productName} (${variant.sku})" sudah ada di daftar`);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        productId: variant.productId,
        productName: variant.productName,
        variantId: variant.variantId,
        variantName: variant.variantName,
        sku: variant.sku,
        image: variant.image,
        priceCost: variant.priceCost,
        systemStock: variant.stock,
        actualStock: variant.stock,
        notes: "",
      },
    ]);
  };

  // Remove single item from form
  const handleRemoveItem = (variantId: string) => {
    setItems((prev) => prev.filter((i) => i.variantId !== variantId));
  };

  // Update actual stock
  const handleActualStockChange = (variantId: string, val: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId
          ? {
              ...item,
              actualStock: val === "" ? "" : Math.max(0, parseInt(val, 10) || 0),
            }
          : item
      )
    );
  };

  // Update row notes
  const handleItemNotesChange = (variantId: string, val: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.variantId === variantId ? { ...item, notes: val } : item
      )
    );
  };

  // Filter catalog list in dropdown selector
  const filteredCatalog = React.useMemo(() => {
    if (!catalogSearch.trim()) return catalog;
    const q = catalogSearch.toLowerCase();
    return catalog.filter(
      (c) =>
        c.productName.toLowerCase().includes(q) ||
        c.variantName.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q)
    );
  }, [catalog, catalogSearch]);

  // Real-time Summary Statistics
  const summary = React.useMemo(() => {
    let surplusCount = 0;
    let shortageCount = 0;
    let matchedCount = 0;
    let totalDifferenceValue = 0;

    for (const item of items) {
      const act = Number(item.actualStock) || 0;
      const diff = act - item.systemStock;
      if (diff > 0) surplusCount += diff;
      else if (diff < 0) shortageCount += Math.abs(diff);
      else matchedCount++;

      totalDifferenceValue += diff * item.priceCost;
    }

    return {
      totalItems: items.length,
      surplusCount,
      shortageCount,
      matchedCount,
      totalDifferenceValue,
    };
  }, [items]);

  // Submit Handler (DRAFT or COMPLETED)
  const handleSubmit = async (targetStatus: "DRAFT" | "COMPLETED") => {
    if (!selectedWarehouseId) {
      toast.error("Gudang wajib dipilih");
      return;
    }

    if (items.length === 0) {
      toast.error("Wajib menambahkan minimal 1 varian produk untuk di-opname");
      return;
    }

    // Validate actual stock inputs
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.actualStock === "" || Number.isNaN(Number(item.actualStock))) {
        toast.error(`Stok fisik untuk "${item.productName} - ${item.sku}" wajib diisi angka`);
        return;
      }
    }

    setLoadingSubmit(true);
    try {
      const payload = {
        warehouseId: selectedWarehouseId,
        status: targetStatus,
        notes: notes.trim() || null,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          systemStock: i.systemStock,
          actualStock: Number(i.actualStock) || 0,
          notes: i.notes.trim() || null,
        })),
      };

      const res = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Gagal menyimpan stock opname");
      }

      toast.success(
        targetStatus === "COMPLETED"
          ? "Stock opname berhasil diselesaikan dan stok gudang telah diperbarui!"
          : "Draft stock opname berhasil disimpan"
      );

      router.push(`/opname/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoadingSubmit(false);
      setConfirmCompleteOpen(false);
    }
  };

  const selectedWarehouseObj = warehouses.find((w) => w.id === selectedWarehouseId);

  return (
    <div className="space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/opname">
            <Button variant="outline" size="icon-sm">
              <ArrowLeftIcon className="size-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Buat Stock Opname
            </h1>
            <p className="text-xs text-muted-foreground">
              Hitung fisik stok aktual gudang dan sinkronkan dengan database sistem
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSubmit("DRAFT")}
            disabled={loadingSubmit || items.length === 0}
            className="gap-1.5 text-xs"
          >
            {loadingSubmit ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <FileTextIcon className="size-3.5" />
            )}
            <span>Simpan Draft</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setConfirmCompleteOpen(true)}
            disabled={loadingSubmit || items.length === 0}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loadingSubmit ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle2Icon className="size-3.5" />
            )}
            <span>Selesaikan & Update Stok</span>
          </Button>
        </div>
      </div>

      {/* Warehouse & Info Selection */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <WarehouseIcon className="size-4 text-primary" />
            <span>Gudang Penugasan</span>
          </div>

          {isSuperAdmin ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Pilih Gudang <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedWarehouseId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedWarehouseId(val);
                    setItems([]); // reset items when warehouse changes
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Pilih Gudang" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((wh) => (
                    <SelectItem key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code || "WH"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Gudang Anda (Terkunci)
              </Label>
              <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                <WarehouseIcon className="size-4 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  {selectedWarehouseObj?.name || "Gudang Penugasan"}
                </span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {selectedWarehouseObj?.code || "WH"}
                </Badge>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-xs md:col-span-2 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileTextIcon className="size-4 text-primary" />
            <span>Catatan Opname</span>
          </div>
          <Textarea
            placeholder="Contoh: Stock opname rutin akhir bulan September 2026..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
          />
        </div>
      </div>

      {/* Summary Statistics Cards */}
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

      {/* Catalog Selector & Table */}
      <div className="rounded-xl border bg-card shadow-xs overflow-hidden space-y-4 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Daftar Barang yang Dihitung
            </h2>
            <p className="text-xs text-muted-foreground">
              Masukkan jumlah stok fisik nyata yang Anda hitung langsung di rak gudang
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddAllCatalog}
              disabled={loadingCatalog || catalog.length === 0}
              className="gap-1.5 text-xs"
            >
              <LayersIcon className="size-3.5 text-primary" />
              <span>Tambah Semua Barang ({catalog.length})</span>
            </Button>
          </div>
        </div>

        {/* Quick Add Single Item Search */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Pilih atau Cari Varian Manual untuk Ditambahkan:
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Ketik nama produk atau SKU..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
          </div>

          {/* Quick results picker */}
          {catalogSearch.trim() && (
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/20 p-1.5 space-y-1">
              {filteredCatalog.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground text-center">
                  Tidak ada barang yang cocok dengan pencarian
                </p>
              ) : (
                filteredCatalog.slice(0, 8).map((variant) => {
                  const isAdded = items.some((i) => i.variantId === variant.variantId);
                  return (
                    <div
                      key={variant.variantId}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {variant.image ? (
                          <div className="relative size-7 rounded overflow-hidden border shrink-0">
                            <Image
                              src={variant.image}
                              alt={variant.variantName}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="size-7 rounded border border-dashed flex items-center justify-center shrink-0">
                            <ImageIcon className="size-3.5 text-muted-foreground/40" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">
                            {variant.productName} ({variant.variantName})
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            SKU: {variant.sku} • Stok Sistem: {variant.stock}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant={isAdded ? "secondary" : "default"}
                        size="sm"
                        disabled={isAdded}
                        onClick={() => handleAddItem(variant)}
                        className="h-7 text-xs gap-1"
                      >
                        {isAdded ? "Sudah di Tabel" : <PlusIcon className="size-3" />}
                        {!isAdded && "Tambah"}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Audit Items Table */}
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12 text-center text-xs">#</TableHead>
                <TableHead className="text-xs">Produk & Varian</TableHead>
                <TableHead className="text-xs w-28 text-center">Stok Sistem</TableHead>
                <TableHead className="text-xs w-36 text-center">Stok Fisik (Nyata)</TableHead>
                <TableHead className="text-xs w-32 text-center">Selisih</TableHead>
                <TableHead className="text-xs">Catatan / Alasan Selisih</TableHead>
                <TableHead className="w-12 text-center text-xs">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <LayersIcon className="size-7 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-foreground">
                        Belum ada barang di dalam tabel perhitungan
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Klik tombol &quot;Tambah Semua Barang&quot; atau cari produk secara spesifik di atas.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, idx) => {
                  const act = Number(item.actualStock) || 0;
                  const diff = act - item.systemStock;

                  return (
                    <TableRow key={item.variantId} className="hover:bg-muted/30">
                      <TableCell className="text-center text-xs text-muted-foreground">
                        {idx + 1}
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex items-center gap-2.5">
                          {item.image ? (
                            <div className="relative size-8 rounded-md overflow-hidden border shrink-0">
                              <Image
                                src={item.image}
                                alt={item.variantName}
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
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.variantName} • <span className="font-mono">{item.sku}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        <Badge variant="outline" className="font-mono text-xs">
                          {item.systemStock}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        <Input
                          type="number"
                          min="0"
                          value={item.actualStock}
                          onChange={(e) =>
                            handleActualStockChange(item.variantId, e.target.value)
                          }
                          className="h-8 text-center text-xs font-semibold w-24 mx-auto"
                          required
                        />
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        {diff === 0 ? (
                          <Badge variant="secondary" className="text-[11px] bg-muted text-muted-foreground">
                            0 (Sesuai)
                          </Badge>
                        ) : diff > 0 ? (
                          <Badge className="text-[11px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                            +{diff} (Lebih)
                          </Badge>
                        ) : (
                          <Badge className="text-[11px] bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">
                            {diff} (Kurang)
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-xs">
                        <Input
                          type="text"
                          placeholder="Alasan selisih (opsional)..."
                          value={item.notes}
                          onChange={(e) =>
                            handleItemNotesChange(item.variantId, e.target.value)
                          }
                          className="h-8 text-xs"
                        />
                      </TableCell>

                      <TableCell className="text-center text-xs">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveItem(item.variantId)}
                          className="text-destructive hover:bg-destructive/10"
                          title="Hapus baris"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Confirmation Dialog for Direct Completion */}
      <AlertDialog open={confirmCompleteOpen} onOpenChange={setConfirmCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Selesaikan Stock Opname?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan langsung menyinkronkan saldo fisik ke sistem inventaris database gudang{" "}
              <span className="font-semibold text-foreground">
                {selectedWarehouseObj?.name || "Gudang"}
              </span>
              . Stok di sistem akan ditimpa dengan jumlah fisik yang Anda input dan status tidak dapat diubah lagi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingSubmit}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmit("COMPLETED");
              }}
              disabled={loadingSubmit}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loadingSubmit ? (
                <>
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                  Menyelesaikan...
                </>
              ) : (
                "Ya, Selesaikan & Update Stok"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
