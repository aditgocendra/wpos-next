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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircleIcon, FolderTreeIcon, Loader2 } from "lucide-react";
import type { CategoryItem } from "@/services/category.service";

interface CategoryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: CategoryItem | null;
  categories: CategoryItem[];
  onSuccess: () => void;
}

interface FormInnerProps {
  category?: CategoryItem | null;
  categories: CategoryItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function CategoryFormInner({
  category,
  categories,
  onClose,
  onSuccess,
}: FormInnerProps) {
  const isEditing = !!category;

  const [name, setName] = React.useState(category?.name || "");
  const [code, setCode] = React.useState(category?.code || "");
  const [parentId, setParentId] = React.useState<string>(
    category?.parentId || "__none__"
  );

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Compute available parent category options (exclude current category and its descendants when editing)
  const availableParentCategories = React.useMemo(() => {
    if (!isEditing || !category) return categories;

    const descendantIds = new Set<string>([category.id]);
    let added = true;
    while (added) {
      added = false;
      for (const c of categories) {
        if (
          c.parentId &&
          descendantIds.has(c.parentId) &&
          !descendantIds.has(c.id)
        ) {
          descendantIds.add(c.id);
          added = true;
        }
      }
    }

    return categories.filter((c) => !descendantIds.has(c.id));
  }, [categories, isEditing, category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const formattedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      setError("Nama kategori wajib diisi.");
      return;
    }

    if (!formattedCode) {
      setError("Kode kategori wajib diisi.");
      return;
    }

    if (formattedCode.length !== 3) {
      setError(
        "Kode kategori harus tepat 3 huruf/angka (contoh: EAR, AUD, CAM)."
      );
      return;
    }

    if (!/^[A-Z0-9]{3}$/.test(formattedCode)) {
      setError(
        "Kode kategori hanya boleh berisi huruf dan angka tanpa spasi atau simbol."
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: trimmedName,
        code: formattedCode,
        parentId: parentId === "__none__" ? null : parentId,
      };

      const url = isEditing
        ? `/api/categories/${category.id}`
        : "/api/categories";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data kategori.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Terjadi kesalahan sistem."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderTreeIcon className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-xl">
              {isEditing ? "Edit Kategori" : "Tambah Kategori Baru"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Perbarui informasi dan struktur hierarki kategori produk."
                : "Isi data formulir berikut untuk menambahkan kategori produk baru."}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {error && (
          <div className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Name Field */}
        <div className="space-y-1.5">
          <Label htmlFor="category-name" className="text-sm font-medium">
            Nama Kategori <span className="text-destructive">*</span>
          </Label>
          <Input
            id="category-name"
            placeholder="Contoh: Earphone, Audio, Electronic"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            autoFocus
          />
        </div>

        {/* Code Field (Min & Max 3 Chars) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="category-code" className="text-sm font-medium">
              Kode Kategori (3 Huruf) <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs font-mono text-muted-foreground">
              {code.length}/3 Karakter
            </span>
          </div>
          <Input
            id="category-code"
            placeholder="Contoh: EAR, AUD, CAM"
            value={code}
            maxLength={3}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={loading}
            className="font-mono uppercase tracking-widest font-bold"
          />
          <p className="text-xs text-muted-foreground">
            Kode 3 huruf unik yang akan digabungkan pada SKU produk, contoh:{" "}
            <span className="font-mono text-foreground font-semibold">
              ({code || "EAR"})-ELC-001-BLK
            </span>
          </p>
        </div>

        {/* Parent Category Field */}
        <div className="space-y-1.5">
          <Label htmlFor="category-parent" className="text-sm font-medium">
            Parent Kategori (Opsional)
          </Label>

          <Select
            value={parentId}
            onValueChange={(val) => setParentId(val ?? "__none__")}
            disabled={loading}
          >
            <SelectTrigger id="category-parent" className="w-full">
              <SelectValue placeholder="Pilih Kategori Induk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">
                <span className="text-muted-foreground font-medium">
                  - Kategori Utama (Root Level) -
                </span>
              </SelectItem>
              {availableParentCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-primary">
                      [{c.code}]
                    </span>
                    <span>{c.fullPath}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pilih kategori induk untuk membuat struktur hierarki multi-level.
          </p>
        </div>

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? "Simpan Perubahan" : "Buat Kategori"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  categories,
  onSuccess,
}: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {open && (
          <CategoryFormInner
            key={category?.id || "create-new"}
            category={category}
            categories={categories}
            onClose={() => onOpenChange(false)}
            onSuccess={onSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
