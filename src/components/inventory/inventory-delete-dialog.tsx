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
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import type { ProductItem } from "@/services/inventory.service";

interface InventoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductItem | null;
  onSuccess: () => void;
}

export function InventoryDeleteDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: InventoryDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);

  if (!product) return null;

  const handleDelete = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/${product.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus produk");
      }

      toast.success(`Produk "${product.name}" berhasil dihapus`);
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

        <div className="space-y-3 py-2 text-sm text-muted-foreground">
          <p>
            Anda akan menghapus produk berikut beserta seluruh varian/SKU di dalamnya:
          </p>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">{product.name}</span>
              <Badge variant="outline" className="font-mono text-xs">
                {product.category.code}
              </Badge>
            </div>
            <div className="text-xs flex items-center justify-between text-muted-foreground">
              <span>Gudang: {product.warehouse.name}</span>
              <span>Total Stok: {product.totalStock} unit</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Jumlah SKU Varian: <strong className="text-foreground">{product.variants.length} varian</strong>
            </div>
          </div>
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
