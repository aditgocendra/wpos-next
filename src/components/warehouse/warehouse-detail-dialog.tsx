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
  WarehouseIcon,
  PackageIcon,
  MapPinIcon,
  CalendarIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "lucide-react";
import type { WarehouseItem } from "@/services/warehouse.service";
import { formatDateTime } from "./warehouse-table";

interface WarehouseDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse: WarehouseItem | null;
  onEdit?: (warehouse: WarehouseItem) => void;
}

export function WarehouseDetailDialog({
  open,
  onOpenChange,
  warehouse,
  onEdit,
}: WarehouseDetailDialogProps) {
  if (!warehouse) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <WarehouseIcon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {warehouse.name}
                </DialogTitle>
                {warehouse.code && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {warehouse.code}
                  </Badge>
                )}
              </div>
              <DialogDescription>
                Informasi detail dan data operasional gudang.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <PackageIcon className="size-3.5 text-primary" />
                <span>Jumlah Produk</span>
              </div>
              <span className="text-xl font-bold tracking-tight">
                {warehouse.productsCount}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5 text-primary" />
                <span>Status Pengelola</span>
              </div>
              <span className="text-sm font-semibold truncate mt-0.5">
                {warehouse.adminUser ? "Terisi (1 Admin)" : "Belum Ditugaskan"}
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="rounded-xl border bg-card p-4 space-y-3.5">
            {/* Admin Warehouse */}
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheckIcon className="size-4" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Admin Warehouse (Pengelola 1-to-1)
                </p>
                {warehouse.adminUser ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold">
                      {warehouse.adminUser.name || warehouse.adminUser.email}
                    </p>
                    {warehouse.adminUser.name && (
                      <span className="text-xs text-muted-foreground">
                        ({warehouse.adminUser.email})
                      </span>
                    )}
                    <Badge
                      variant={
                        warehouse.adminUser.status === "ACTIVE"
                          ? "default"
                          : "secondary"
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {warehouse.adminUser.status}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Belum ada Admin Warehouse yang ditugaskan ke gudang ini
                  </p>
                )}
              </div>
            </div>

            {/* Address */}
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <MapPinIcon className="size-4" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Alamat Gudang
                </p>
                <p className="text-sm">
                  {warehouse.address || (
                    <span className="italic text-muted-foreground">
                      Tidak ada alamat tercatat
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 shrink-0" />
                <span>Dibuat: {formatDateTime(warehouse.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5 shrink-0" />
                <span>Diperbarui: {formatDateTime(warehouse.updatedAt)}</span>
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
                onEdit(warehouse);
              }}
            >
              Edit Gudang
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
