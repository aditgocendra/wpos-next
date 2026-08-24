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
  ReceiptIcon,
  WarehouseIcon,
  CalendarIcon,
  FileTextIcon,
  UserIcon,
  BoxesIcon,
} from "lucide-react";
import type { TransactionData } from "@/services/transaction.service";

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

interface TransactionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionData | null;
}

export function TransactionDetailDialog({
  open,
  onOpenChange,
  transaction,
}: TransactionDetailDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <ReceiptIcon className="size-5 text-primary" />
                {transaction.transactionNumber}
              </DialogTitle>
              <DialogDescription>
                Detail rincian transaksi penjualan dan item barang
              </DialogDescription>
            </div>
            <div>
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400">
                COMPLETED
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Warehouse & Cashier Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <WarehouseIcon className="size-4 text-primary" />
                Lokasi Gudang
              </div>
              <div className="text-base font-bold">
                {transaction.warehouse?.name}
              </div>
              {transaction.warehouse?.code && (
                <div className="text-xs text-muted-foreground">
                  Kode: {transaction.warehouse.code}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <UserIcon className="size-4 text-emerald-500" />
                Kasir / Pembuat
              </div>
              <div className="text-base font-bold">
                {transaction.createdBy?.name || "Kasir"}
              </div>
              <div className="text-xs text-muted-foreground">
                {transaction.createdBy?.email}
              </div>
            </div>
          </div>

          {/* Time & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarIcon className="size-4" />
              <span>Tanggal: {formatDateTime(transaction.createdAt)}</span>
            </div>
            {transaction.notes && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileTextIcon className="size-4" />
                <span>Catatan: {transaction.notes}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <BoxesIcon className="size-4 text-primary" />
                Rincian Barang Penjualan ({transaction.items?.length || 0} Item)
              </div>
              <div className="text-xs text-muted-foreground">
                Total Kuantitas:{" "}
                <span className="font-semibold text-foreground">
                  {transaction.totalQuantity} pcs
                </span>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 text-xs">
                    <TableHead className="font-semibold">Nama Produk</TableHead>
                    <TableHead className="font-semibold">Varian</TableHead>
                    <TableHead className="text-right font-semibold">Harga Satuan</TableHead>
                    <TableHead className="text-right font-semibold">Qty</TableHead>
                    <TableHead className="text-right font-semibold">Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transaction.items && transaction.items.length > 0 ? (
                    transaction.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="font-normal">
                            {item.variantName}
                          </Badge>
                          {item.sku && item.sku !== "-" && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              SKU: {item.sku}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          Rp {item.price.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm tabular-nums text-primary">
                          Rp {item.totalPrice.toLocaleString("id-ID")}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-6 text-muted-foreground text-sm"
                      >
                        Tidak ada rincian item barang.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Total Bayar Footer */}
            <div className="flex justify-between items-center bg-muted/60 p-4 rounded-xl border mt-3">
              <div className="text-sm font-semibold">Total Pembayaran</div>
              <div className="text-xl font-bold text-primary tabular-nums">
                Rp {transaction.totalAmount.toLocaleString("id-ID")}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
