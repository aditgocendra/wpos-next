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
  FolderTreeIcon,
  PackageIcon,
  CalendarIcon,
  ClockIcon,
  LayersIcon,
  CornerDownRightIcon,
  GitBranchIcon,
} from "lucide-react";
import type { CategoryItem } from "@/services/category.service";

export function formatDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return "-";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => n.toString().padStart(2, "0");
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
}

interface CategoryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryItem | null;
  onEdit?: (category: CategoryItem) => void;
}

export function CategoryDetailDialog({
  open,
  onOpenChange,
  category,
  onEdit,
}: CategoryDetailDialogProps) {
  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderTreeIcon className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold tracking-tight">
                  {category.name}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="font-mono text-xs font-bold tracking-wider px-2 py-0.5 bg-primary/5 text-primary border-primary/20"
                >
                  {category.code}
                </Badge>
              </div>
              <DialogDescription>
                Detail informasi kategori dan susunan hierarki produk.
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
                {category.productsCount}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-xl border bg-muted/30 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <GitBranchIcon className="size-3.5 text-primary" />
                <span>Subkategori Langsung</span>
              </div>
              <span className="text-xl font-bold tracking-tight">
                {category.childrenCount}
              </span>
            </div>
          </div>

          {/* Details Section */}
          <div className="rounded-xl border bg-card p-4 space-y-3.5">
            {/* Hierarchical Breadcrumb Path */}
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <LayersIcon className="size-4" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Jalur Hierarki (Full Path)
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-sm font-semibold">
                  {category.fullPath.split(" > ").map((segment, idx, arr) => (
                    <React.Fragment key={idx}>
                      <span
                        className={
                          idx === arr.length - 1
                            ? "text-primary font-bold"
                            : "text-foreground"
                        }
                      >
                        {segment}
                      </span>
                      {idx < arr.length - 1 && (
                        <span className="text-muted-foreground text-xs font-normal">
                          &gt;
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tingkat kedalaman: Level {category.level} (
                  {category.level === 0 ? "Kategori Utama" : `Subkategori ke-${category.level}`}
                  )
                </p>
              </div>
            </div>

            {/* Parent Category */}
            <div className="flex items-start gap-3 pt-2 border-t">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <FolderTreeIcon className="size-4" />
              </div>
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Kategori Induk (Parent)
                </p>
                {category.parent ? (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{category.parent.name}</p>
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                      {category.parent.code}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Merupakan Kategori Utama (Root Level)
                  </p>
                )}
              </div>
            </div>

            {/* Subcategories list */}
            {category.children && category.children.length > 0 && (
              <div className="pt-2 border-t space-y-2">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CornerDownRightIcon className="size-3.5" />
                  <span>Daftar Subkategori ({category.children.length}):</span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {category.children.map((ch) => (
                    <Badge
                      key={ch.id}
                      variant="secondary"
                      className="text-xs py-1 px-2.5 flex items-center gap-1.5"
                    >
                      <span className="font-mono font-bold text-[10px] text-primary">
                        [{ch.code}]
                      </span>
                      <span>{ch.name}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* SKU Example */}
            <div className="pt-2 border-t text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Format SKU Terintegrasi:</p>
              <div className="rounded-md bg-muted/60 p-2 font-mono text-xs flex items-center justify-between">
                <span>
                  ({category.code})-PROD-001-VAR
                </span>
                <span className="text-[10px] text-muted-foreground italic">
                  Otomatis memakai kode 3 huruf
                </span>
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 shrink-0" />
                <span>Dibuat: {formatDateTime(category.createdAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ClockIcon className="size-3.5 shrink-0" />
                <span>Diperbarui: {formatDateTime(category.updatedAt)}</span>
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
                onEdit(category);
              }}
            >
              Edit Kategori
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Tutup</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
