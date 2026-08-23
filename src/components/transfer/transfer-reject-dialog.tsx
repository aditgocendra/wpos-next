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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { XCircleIcon, Loader2Icon } from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";

interface TransferRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferData | null;
  onSuccess: () => void;
}

export function TransferRejectDialog({
  open,
  onOpenChange,
  transfer,
  onSuccess,
}: TransferRejectDialogProps) {
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setReason("");
      setError(null);
    }
  }, [open]);

  const handleReject = async () => {
    if (!transfer) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/transfers/${transfer.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal membatalkan transfer stok");
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
              <XCircleIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">
                Tolak / Batalkan Transfer
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Status transfer akan diubah menjadi CANCELLED.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm">
          <p className="text-foreground">
            Apakah Anda yakin ingin menolak transfer{" "}
            <span className="font-semibold text-destructive">
              {transfer.transferNumber}
            </span>{" "}
            dari{" "}
            <span className="font-medium">
              {transfer.sourceWarehouse?.name}
            </span>{" "}
            ke{" "}
            <span className="font-medium">
              {transfer.destinationWarehouse?.name}
            </span>
            ?
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="reject-reason" className="text-xs font-semibold">
              Alasan Penolakan (Opsional)
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="Contoh: Stok fisik di gudang tidak sesuai, pesanan salah, dll..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="resize-none text-xs"
            />
          </div>

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
            onClick={handleReject}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <XCircleIcon className="mr-2 size-4" />
                Tolak Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
