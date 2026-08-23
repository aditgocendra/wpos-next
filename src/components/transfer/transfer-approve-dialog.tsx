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
import { CheckCircle2Icon, Loader2Icon, ArrowRightLeftIcon } from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";

interface TransferApproveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferData | null;
  onSuccess: () => void;
}

export function TransferApproveDialog({
  open,
  onOpenChange,
  transfer,
  onSuccess,
}: TransferApproveDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleApprove = async () => {
    if (!transfer) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transfers/${transfer.id}/execute`, {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyetujui transfer stok");
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
            <div className="flex size-10 items-center justify-center rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <CheckCircle2Icon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Setujui & Eksekusi Transfer
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Stok akan dipindahkan secara atomik antar gudang.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <p className="text-foreground">
            Apakah Anda yakin ingin menyetujui transfer{" "}
            <span className="font-semibold text-primary">
              {transfer.transferNumber}
            </span>
            ?
          </p>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gudang Asal:</span>
              <span className="font-semibold">{transfer.sourceWarehouse?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Gudang Tujuan:</span>
              <span className="font-semibold">{transfer.destinationWarehouse?.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total Kuantitas:</span>
              <span className="font-bold text-primary">{transfer.totalQuantity} unit ({transfer.items.length} item)</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            ⚠️ Sistem akan langsung mengurangi stok di <strong>{transfer.sourceWarehouse?.name}</strong> dan menambah stok di <strong>{transfer.destinationWarehouse?.name}</strong>.
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
            className="bg-green-600 hover:bg-green-700 text-white dark:bg-green-600 dark:hover:bg-green-700"
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <ArrowRightLeftIcon className="mr-2 size-4" />
                Setujui Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
