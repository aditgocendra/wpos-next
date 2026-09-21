"use client";

import * as React from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckIcon,
  ImageIcon,
  LayersIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InventoryVariant {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  image?: string | null;
  priceCost: number;
  stock: number;
}

interface OpnameProductSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: InventoryVariant[];
  existingVariantIds: string[];
  onAddVariants: (variants: InventoryVariant[]) => void;
  loading?: boolean;
  warehouseName?: string;
}

export function OpnameProductSelectDialog({
  open,
  onOpenChange,
  catalog,
  existingVariantIds,
  onAddVariants,
  loading = false,
  warehouseName,
}: OpnameProductSelectDialogProps) {
  const [search, setSearch] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Existing variant IDs as a Set for fast lookup
  const existingSet = React.useMemo(
    () => new Set(existingVariantIds),
    [existingVariantIds]
  );

  // Reset search and selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedIds(new Set());
    }
  }, [open]);

  // Filter catalog based on search keyword
  const filteredCatalog = React.useMemo(() => {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase().trim();
    return catalog.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        item.variantName.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  // Selectable variants among filtered (not already in the form)
  const selectableFiltered = React.useMemo(
    () => filteredCatalog.filter((v) => !existingSet.has(v.variantId)),
    [filteredCatalog, existingSet]
  );

  // Check if all selectable filtered variants are currently selected
  const allFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((v) => selectedIds.has(v.variantId));

  // Toggle select all filtered items
  const handleToggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        // Deselect all visible selectable items
        for (const item of selectableFiltered) {
          next.delete(item.variantId);
        }
      } else {
        // Select all visible selectable items
        for (const item of selectableFiltered) {
          next.add(item.variantId);
        }
      }
      return next;
    });
  };

  // Toggle individual item
  const handleToggleItem = (variantId: string) => {
    if (existingSet.has(variantId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  // Submit selected items
  const handleConfirm = () => {
    const selectedVariants = catalog.filter((v) => selectedIds.has(v.variantId));
    if (selectedVariants.length === 0) return;
    onAddVariants(selectedVariants);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl w-full max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Dialog Header */}
        <DialogHeader className="p-4 sm:p-5 border-b pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <LayersIcon className="size-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-semibold">
                  Pilih Barang untuk Stock Opname
                </DialogTitle>
                {warehouseName && (
                  <Badge variant="outline" className="text-[11px] font-medium bg-muted/40 text-foreground">
                    {warehouseName}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {warehouseName
                  ? `Menampilkan saldo stok sistem untuk gudang "${warehouseName}". Pilih barang yang akan dimasukkan ke tabel audit fisik.`
                  : "Pilih satu, beberapa, atau semua barang dari gudang untuk dimasukkan ke tabel audit fisik"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Search & Selection Toolbar */}
        <div className="p-3 sm:p-4 border-b bg-muted/20 space-y-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Input */}
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari berdasarkan nama produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-8 h-9 text-xs"
                autoFocus
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              )}
            </div>

            {/* Select All Quick Button */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleSelectAll}
                disabled={selectableFiltered.length === 0}
                className="h-9 text-xs gap-1.5 shrink-0"
              >
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={handleToggleSelectAll}
                  disabled={selectableFiltered.length === 0}
                  className="pointer-events-none"
                  aria-label="Pilih semua produk"
                />
                <span>
                  {allFilteredSelected ? "Batalkan Semua" : "Pilih Semua"}
                </span>
                <span className="text-[11px] text-muted-foreground ml-0.5">
                  ({selectableFiltered.length})
                </span>
              </Button>

              {selectedIds.size > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset Pilihan
                </Button>
              )}
            </div>
          </div>

          {/* Status info bar */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5">
            <span>
              Menampilkan {filteredCatalog.length} dari total {catalog.length} varian barang
            </span>
            {selectedIds.size > 0 && (
              <Badge variant="secondary" className="text-[11px] font-medium">
                {selectedIds.size} dipilih
              </Badge>
            )}
          </div>
        </div>

        {/* Scrollable Products List */}
        <div className="m-4 border rounded-lg flex-1 overflow-y-auto min-h-[220px] max-h-[48vh] divide-y">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-2">
              <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-xs">Memuat daftar barang...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-2">
              <SearchIcon className="size-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">
                Tidak ada barang yang ditemukan
              </p>
              <p className="text-xs max-w-sm">
                {search
                  ? `Tidak ada produk atau SKU yang cocok dengan kata kunci "${search}".`
                  : "Gudang ini belum memiliki produk terdaftar."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={handleToggleSelectAll}
                      disabled={selectableFiltered.length === 0}
                      aria-label="Pilih semua varian"
                    />
                  </TableHead>
                  <TableHead className="text-xs">Produk & Varian</TableHead>
                  <TableHead className="text-xs w-32">SKU</TableHead>
                  <TableHead className="text-xs w-36 text-center">
                    <div>Stok Sistem</div>
                    {warehouseName && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({warehouseName})
                      </span>
                    )}
                  </TableHead>
                  <TableHead className="text-xs w-32 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCatalog.map((variant) => {
                  const isAlreadyAdded = existingSet.has(variant.variantId);
                  const isChecked = selectedIds.has(variant.variantId);

                  return (
                    <TableRow
                      key={variant.variantId}
                      onClick={() => {
                        if (!isAlreadyAdded) {
                          handleToggleItem(variant.variantId);
                        }
                      }}
                      className={cn(
                        "transition-colors text-xs",
                        isAlreadyAdded
                          ? "opacity-60 bg-muted/20 cursor-not-allowed"
                          : "cursor-pointer hover:bg-muted/50",
                        isChecked && !isAlreadyAdded && "bg-primary/5"
                      )}
                    >
                      {/* Checkbox Column */}
                      <TableCell
                        className="text-center p-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isChecked || isAlreadyAdded}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggleItem(variant.variantId)}
                          aria-label={`Pilih ${variant.productName}`}
                        />
                      </TableCell>

                      {/* Product details */}
                      <TableCell className="p-2.5">
                        <div className="flex items-center gap-2.5">
                          {variant.image ? (
                            <div className="relative size-8 rounded overflow-hidden border shrink-0">
                              <Image
                                src={variant.image}
                                alt={variant.variantName}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="size-8 rounded border border-dashed flex items-center justify-center shrink-0">
                              <ImageIcon className="size-4 text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-foreground truncate max-w-[240px] sm:max-w-[320px]">
                              {variant.productName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {variant.variantName}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      {/* SKU */}
                      <TableCell className="p-2.5 font-mono text-[11px]">
                        {variant.sku}
                      </TableCell>

                      {/* Stock */}
                      <TableCell className="p-2.5 text-center font-mono font-medium">
                        {variant.stock}
                      </TableCell>

                      {/* Status badge */}
                      <TableCell className="p-2.5 text-center">
                        {isAlreadyAdded ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <CheckIcon className="size-3 text-muted-foreground" />
                            <span>Sudah di Tabel</span>
                          </Badge>
                        ) : isChecked ? (
                          <Badge className="text-[10px] bg-primary/15 text-primary border-primary/20">
                            Terpilih
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Dialog Footer */}
        <DialogFooter className="m-0 p-4 border-t bg-muted/30 shrink-0 flex flex-row items-center justify-between sm:justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {selectedIds.size > 0 ? (
              <span>
                <strong className="text-foreground">{selectedIds.size}</strong> barang terpilih
              </span>
            ) : (
              <span>Belum ada barang dipilih</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8"
            >
              Tutup
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="text-xs h-8 gap-1.5"
            >
              <PlusIcon className="size-3.5" />
              <span>Tambahkan ({selectedIds.size})</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
