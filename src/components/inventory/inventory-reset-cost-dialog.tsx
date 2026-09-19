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
import { toast } from "sonner";
import { RefreshCcwIcon } from "lucide-react";
import type { ProductVariantItem } from "@/services/inventory.service";

interface InventoryResetCostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: ProductVariantItem | null;
  productName: string;
  onSuccess: () => void;
}

export function InventoryResetCostDialog({
  open,
  onOpenChange,
  variant,
  productName,
  onSuccess,
}: InventoryResetCostDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [newCost, setNewCost] = React.useState<string>("");

  React.useEffect(() => {
    if (open && variant) {
      setNewCost(variant.priceCost.toString());
    } else {
      setNewCost("");
    }
  }, [open, variant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!variant) return;

    const costNum = Number(newCost);
    if (isNaN(costNum) || costNum < 0) {
      toast.error("Harga modal harus berupa angka yang valid");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/variants/${variant.id}/cost`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ priceCost: costNum }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah HPP (Harga Modal)");
      }

      toast.success("Berhasil mereset HPP (Harga Modal)");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Terjadi kesalahan sistem"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!variant) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcwIcon className="size-5 text-primary" />
            Reset HPP (Harga Modal)
          </DialogTitle>
          <DialogDescription>
            Ubah Harga Pokok Penjualan (HPP) / Modal untuk varian{" "}
            <strong className="text-foreground">{productName} - {variant.variantName}</strong>{" "}
            (SKU: <span className="font-mono">{variant.sku}</span>).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="priceCost">Harga Modal Baru (Rp)</Label>
            <Input
              id="priceCost"
              type="number"
              min="0"
              required
              value={newCost}
              onChange={(e) => setNewCost(e.target.value)}
              placeholder="Contoh: 50000"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Aksi ini akan menimpa harga modal rata-rata (moving average) dengan nilai yang baru secara permanen.
            </p>
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
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
