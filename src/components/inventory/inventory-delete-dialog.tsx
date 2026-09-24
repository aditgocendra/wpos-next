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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangleIcon, RefreshCwIcon, WarehouseIcon } from "lucide-react";
import { toast } from "sonner";
import type { ProductItem } from "@/services/inventory.service";

interface InventoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
  warehouses: { id: string; name: string; code?: string | null }[];
  onSuccess: () => void;
}

export function InventoryDeleteDialog({
  open,
  onOpenChange,
  product,
  warehouses,
  onSuccess,
}: InventoryDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = React.useState<string>("ALL");

  // Reset state when opened
  React.useEffect(() => {
    if (open) {
      setSelectedWarehouseId("ALL");
    }
  }, [open]);

  if (!product) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      
      let url = `/api/inventory/${product.id}`;
      if (selectedWarehouseId !== "ALL") {
        url += `?warehouseId=${selectedWarehouseId}`;
      }
      
      const res = await fetch(url, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus produk");
      }

      toast.success(
        selectedWarehouseId === "ALL" 
          ? `Produk "${product.name}" berhasil dihapus sepenuhnya`
          : `Produk "${product.name}" berhasil dihapus dari gudang yang dipilih`
      );
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Terjadi kesalahan saat menghapus"
      );
    } finally {
      setLoading(false);
    }
  };

  const isFullDelete = selectedWarehouseId === "ALL";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangleIcon className="size-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Hapus Produk?
              </DialogTitle>
              <DialogDescription>
                Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm text-muted-foreground">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">
              Pilih Lokasi Penghapusan:
            </label>
            <Select
              value={selectedWarehouseId}
              onValueChange={(val) => val && setSelectedWarehouseId(val)}
              disabled={loading}
            >
              <SelectTrigger className="w-full">
                <WarehouseIcon className="size-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-destructive font-medium">
                  Hapus dari Semua Gudang (Hapus Permanen Produk)
                </SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={wh.id}>
                    Hanya dari: {wh.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{product.name}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {product.category.code}
              </Badge>
            </div>
            <div className="text-xs flex items-center justify-between text-muted-foreground">
              <span>Total Stok (Semua Gudang): {product.totalStock} unit</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Jumlah SKU Varian: <strong className="text-foreground">{product.variants.length} varian</strong>
            </div>
          </div>
          
          {isFullDelete ? (
            <p className="text-destructive text-xs">
              <strong className="font-semibold">PERINGATAN:</strong> Anda memilih untuk menghapus produk dari <strong>Semua Gudang</strong>. Ini akan menghapus data produk secara permanen beserta seluruh varian/SKU di dalamnya.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Produk hanya akan dihapus (stok di-nol-kan) pada gudang yang Anda pilih. Data produk tetap tersimpan di sistem.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            className="gap-2"
          >
            {loading && <RefreshCwIcon className="size-4 animate-spin" />}
            <span>Hapus Produk</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
