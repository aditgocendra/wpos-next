"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowRightLeftIcon,
  WarehouseIcon,
  CalendarIcon,
  FileTextIcon,
  LayersIcon,
  BoxesIcon,
} from "lucide-react";
import type { StockTransferData } from "@/services/transfer.service";

export function formatDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "-";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "-";

  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

export function getStatusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return (
        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400">
          PENDING
        </Badge>
      );
    case "IN_TRANSIT":
      return (
        <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400">
          IN TRANSIT
        </Badge>
      );
    case "TRANSFERED":
      return (
        <Badge className="bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400">
          TRANSFERED
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge className="bg-destructive/15 text-destructive border-destructive/30">
          CANCELLED
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

interface TransferDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transfer: StockTransferData | null;
}

export function TransferDetailDialog({
  open,
  onOpenChange,
  transfer,
}: TransferDetailDialogProps) {
  if (!transfer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[33.333vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeftIcon className="size-5 text-primary" />
                {transfer.transferNumber}
              </DialogTitle>
              <DialogDescription>
                Detail rincian transfer stok dan varian barang
              </DialogDescription>
            </div>
            <div>{getStatusBadge(transfer.status)}</div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Gudang Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <WarehouseIcon className="size-4 text-amber-500" />
                Gudang Asal
              </div>
              <div className="text-base font-bold">
                {transfer.sourceWarehouse?.name}
              </div>
              {transfer.sourceWarehouse?.code && (
                <div className="text-xs text-muted-foreground">
                  Kode: {transfer.sourceWarehouse.code}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <WarehouseIcon className="size-4 text-emerald-500" />
                Gudang Tujuan
              </div>
              <div className="text-base font-bold">
                {transfer.destinationWarehouse?.name}
              </div>
              {transfer.destinationWarehouse?.code && (
                <div className="text-xs text-muted-foreground">
                  Kode: {transfer.destinationWarehouse.code}
                </div>
              )}
            </div>
          </div>

          {/* Transfer Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 rounded-lg border p-4 bg-background text-sm">
            <div>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <CalendarIcon className="size-3.5" /> Dibuat Pada
              </span>
              <span className="font-medium">{formatDateTime(transfer.createdAt)}</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <FileTextIcon className="size-3.5" /> Dibuat Oleh
              </span>
              <span className="font-medium">
                {transfer.createdBy?.name || transfer.createdBy?.email || "-"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                <BoxesIcon className="size-3.5" /> Total Kuantitas
              </span>
              <span className="font-bold text-primary">
                {transfer.totalQuantity} unit
              </span>
            </div>
          </div>

          {transfer.notes && (
            <div className="rounded-lg border border-dashed p-3 bg-muted/20 text-sm">
              <span className="font-semibold text-xs text-muted-foreground uppercase block mb-1">
                Catatan
              </span>
              <p className="text-foreground">{transfer.notes}</p>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <LayersIcon className="size-4 text-primary" />
              Daftar Produk & Varian yang Ditransfer ({transfer.items.length} Item)
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead>Nama Produk</TableHead>
                    <TableHead>Varian</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty Ditransfer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfer.items.map((item, idx) => (
                    <TableRow key={item.id || idx}>
                      <TableCell className="text-center text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.productName}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {item.variantName}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {item.sku}
                      </TableCell>
                      <TableCell className="text-right font-bold text-primary">
                        {item.quantity}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
