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
import { AlertTriangleIcon, Loader2 } from "lucide-react";
import type { WarehouseItem } from "@/services/warehouse.service";

interface WarehouseDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: WarehouseItem | null;
  onSuccess: () => void;
}

export function WarehouseDeleteDialog({
  open,
  onOpenChange,
  warehouse,
  onSuccess,
}: WarehouseDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  if (!warehouse) return null;

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/warehouses/${warehouse.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus gudang.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangleIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Konfirmasi Hapus Gudang
              </DialogTitle>
              <DialogDescription>
                Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          <p className="text-muted-foreground">
            Apakah Anda yakin ingin menghapus gudang{" "}
            <strong className="text-foreground">{warehouse.name}</strong>{" "}
            {warehouse.code && (
              <span className="font-mono font-medium text-foreground">
                ({warehouse.code})
              </span>
            )}
            ?
          </p>

          {warehouse.adminUser && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <span className="font-semibold">Perhatian:</span> Admin Warehouse (
              <span className="font-medium text-foreground">
                {warehouse.adminUser.name || warehouse.adminUser.email}
              </span>
              ) yang bertugas di gudang ini akan dilepas penugasannya secara
              otomatis.
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Hapus Gudang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
