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
import { Trash2Icon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";

interface TransferDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferData | null;
  onSuccess: () => void;
}

export function TransferDeleteDialog({
  open,
  onOpenChange,
  transfer,
  onSuccess,
}: TransferDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleDelete = async () => {
    if (!transfer) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transfers/${transfer.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus transfer stok");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  if (!transfer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangleIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Konfirmasi Hapus Transfer
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <p className="text-foreground">
            Apakah Anda yakin ingin menghapus transfer{" "}
            <span className="font-semibold text-destructive">
              {transfer.transferNumber}
            </span>{" "}
            dari{" "}
            <span className="font-medium">
              {transfer.sourceWarehouse?.name}
            </span>{" "}
            menuju{" "}
            <span className="font-medium">
              {transfer.destinationWarehouse?.name}
            </span>
            ?
          </p>

          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              <>
                <Trash2Icon className="mr-2 size-4" />
                Hapus Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
