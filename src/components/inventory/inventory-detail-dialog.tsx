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
import { Badge } from "@/components/ui/badge";
import {
  BoxesIcon,
  WarehouseIcon,
  FolderTreeIcon,
  CalendarIcon,
  UserIcon,
  TagIcon,
  TrendingUpIcon,
  LayersIcon,
  ImageIcon,
  ZoomInIcon,
} from "lucide-react";
import Image from "next/image";
import type { ProductItem } from "@/services/inventory.service";
import { ImageZoomDialog } from "@/components/ui/image-zoom-dialog";

export function formatDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface InventoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
  onEdit?: (product: ProductItem) => void;
}

export function InventoryDetailDialog({
  open,
  onOpenChange,
  product,
  onEdit,
}: InventoryDetailDialogProps) {
  const [zoomImage, setZoomImage] = React.useState<{ src: string; title: string } | null>(null);

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BoxesIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-xl font-bold tracking-tight truncate">
                  {product.name}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold tracking-wider px-2 py-0.5 bg-primary/5 text-primary border-primary/20"
                >
                  {product.category.code}
                </Badge>
              </div>
              <DialogDescription className="truncate">
                {product.category.name}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BoxesIcon className="size-3.5 text-primary" />
                <span>Total Stok</span>
              </div>
              <span className="text-2xl font-bold tracking-tight">
                {product.totalStock}{" "}
                <span className="text-xs font-normal text-muted-foreground">unit</span>
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUpIcon className="size-3.5 text-blue-600 dark:text-blue-400" />
                <span>HPP Rata-rata</span>
              </div>
              <span className="text-lg font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {formatRupiah(product.avgCostPrice)}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LayersIcon className="size-3.5 text-purple-600 dark:text-purple-400" />
                <span>Jumlah SKU / Varian</span>
              </div>
              <span className="text-2xl font-bold tracking-tight text-purple-600 dark:text-purple-400">
                {product.variants.length}
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="rounded-xl border bg-card p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FolderTreeIcon className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Kategori</p>
                  <p className="text-sm font-semibold">{product.category.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Kode: [{product.category.code}]
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
                  <WarehouseIcon className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Gudang Penyimpanan</p>
                  <p className="text-sm font-semibold">Multi-Gudang</p>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Lihat detail stok tiap gudang di menu Stok
                  </p>
                </div>
              </div>
            </div>

            {/* List of Variants */}
            <div className="pt-3 border-t space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <TagIcon className="size-3.5 text-primary" />
                  <span>Daftar Varian & SKU Produk ({product.variants.length})</span>
                </p>
              </div>

              <div className="space-y-2">
                {product.variants.map((variant, idx) => {
                  const variantImg =
                    variant.image ||
                    (variant.images && variant.images.length > 0
                      ? variant.images[0].image
                      : null);

                  return (
                    <div
                      key={variant.id || idx}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {variantImg ? (
                          <button
                            type="button"
                            onClick={() =>
                              setZoomImage({
                                src: variantImg,
                                title: `${product.name} - ${variant.variantName}`,
                              })
                            }
                            className="relative group size-12 rounded-lg overflow-hidden border bg-muted shrink-0 hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                            title="Klik untuk memperbesar gambar"
                          >
                            <Image
                              src={variantImg}
                              alt={variant.variantName}
                              fill
                              unoptimized
                              sizes="48px"
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ZoomInIcon className="size-4 text-white" />
                            </div>
                          </button>
                        ) : (
                          <div className="size-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground/40 bg-muted/10 shrink-0">
                            <ImageIcon className="size-5" />
                          </div>
                        )}

                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {variant.variantName}
                            </span>
                            <Badge
                              variant="outline"
                              className="font-mono text-[11px] font-bold px-2 py-0.5 bg-background shadow-2xs"
                            >
                              {variant.sku}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Stok Tersedia (Total):{" "}
                            <strong className="text-foreground">
                              {variant.warehouseStocks?.reduce(
                                (sum, s) => sum + s.stock,
                                0
                              ) || 0}{" "}
                              unit
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs self-end sm:self-center">
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px]">
                            Harga Modal (Cost)
                          </p>
                          <p className="font-semibold">
                            {formatRupiah(variant.priceCost)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-muted-foreground text-[10px]">
                            Harga Jual (Sell)
                          </p>
                          <p className="font-bold text-primary">
                            {formatRupiah(variant.priceSell)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Audit Trail */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <UserIcon className="size-3.5 shrink-0" />
                <span>
                  Dibuat oleh: <strong>{product.createdBy?.name || product.createdBy?.email}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarIcon className="size-3.5 shrink-0" />
                <span>Waktu: {formatDateTime(product.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          {onEdit && (
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEdit(product);
              }}
            >
              Edit Produk
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>

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
