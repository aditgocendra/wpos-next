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
import type { CategoryItem } from "@/services/category.service";

interface CategoryDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryItem | null;
  onSuccess: () => void;
}

interface DeleteInnerProps {
  category: CategoryItem;
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryDeleteInner({
  category,
  onClose,
  onSuccess,
}: DeleteInnerProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/categories/${category.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus kategori");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan sistem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-lg font-bold">
              Hapus Kategori
            </DialogTitle>
            <DialogDescription>
              Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-3 py-2">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <p className="text-sm text-foreground">
          Apakah Anda yakin ingin menghapus kategori{" "}
          <strong className="font-semibold">{category.name}</strong>{" "}
          <span className="font-mono font-bold text-xs text-muted-foreground">
            ({category.code})
          </span>
          ?
        </p>

        {category.childrenCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <p className="font-semibold">Perhatian (Relasi Hierarki):</p>
            <p className="mt-0.5">
              Kategori ini memiliki{" "}
              <strong>{category.childrenCount} subkategori</strong>. Menghapus
              kategori ini juga akan menghapus seluruh rantai subkategori di
              bawahnya.
            </p>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
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
          Hapus Kategori
        </Button>
      </DialogFooter>
    </>
  );
}

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  onSuccess,
}: CategoryDeleteDialogProps) {
  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        {open && (
          <CategoryDeleteInner
            key={category.id}
            category={category}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
