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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircleIcon, Loader2, WarehouseIcon } from "lucide-react";
import type { WarehouseItem, WarehouseAdminUser } from "@/services/warehouse.service";

interface WarehouseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  warehouse?: WarehouseItem | null;
  adminUsers: WarehouseAdminUser[];
  onSuccess: () => void;
}

export function WarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
  adminUsers,
  onSuccess,
}: WarehouseFormDialogProps) {
  const isEditing = !!warehouse;

  const [name, setName] = React.useState("");
  const [code, setCode] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [adminUserId, setAdminUserId] = React.useState<string>("__none__");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const hasAdminUsers = adminUsers.length > 0;

  React.useEffect(() => {
    if (open) {
      setError(null);
      if (warehouse) {
        setName(warehouse.name);
        setCode(warehouse.code || "");
        setAddress(warehouse.address || "");
        setAdminUserId(warehouse.adminUser?.id || "__none__");
      } else {
        setName("");
        setCode("");
        setAddress("");
        setAdminUserId("__none__");
      }
    }
  }, [open, warehouse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Nama gudang wajib diisi.");
      return;
    }

    if (!code.trim()) {
      setError("Kode gudang wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim() || null,
        adminUserId: adminUserId === "__none__" ? null : adminUserId,
      };

      const url = isEditing
        ? `/api/warehouses/${warehouse.id}`
        : "/api/warehouses";
      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan data gudang.");
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
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <WarehouseIcon className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl">
                {isEditing ? "Edit Gudang" : "Tambah Gudang Baru"}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Perbarui informasi gudang dan tetapkan admin warehouse."
                  : "Isi data formulir berikut untuk menambahkan gudang baru."}
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
            <Label htmlFor="warehouse-name" className="text-sm font-medium">
              Nama Gudang <span className="text-destructive">*</span>
            </Label>
            <Input
              id="warehouse-name"
              placeholder="Contoh: Gudang Pusat Jakarta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Code Field */}
          <div className="space-y-1.5">
            <Label htmlFor="warehouse-code" className="text-sm font-medium">
              Kode Gudang <span className="text-destructive">*</span>
            </Label>
            <Input
              id="warehouse-code"
              placeholder="Contoh: WH-JKT-01"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={loading}
              className="font-mono uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Kode harus unik untuk setiap gudang.
            </p>
          </div>

          {/* Address Field */}
          <div className="space-y-1.5">
            <Label htmlFor="warehouse-address" className="text-sm font-medium">
              Alamat Gudang
            </Label>
            <Textarea
              id="warehouse-address"
              placeholder="Masukkan alamat lengkap lokasi gudang..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Admin Warehouse Select Field */}
          <div className="space-y-2">
            <Label htmlFor="admin-warehouse-select" className="text-sm font-medium">
              Admin Warehouse
            </Label>

            <Select
              value={adminUserId}
              onValueChange={(val) => setAdminUserId(val ?? "__none__")}
              disabled={loading || !hasAdminUsers}
            >
              <SelectTrigger id="admin-warehouse-select" className="w-full">
                <SelectValue placeholder="Pilih Admin Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">
                    - Tidak Ada Admin (Belum Ditetapkan) -
                  </span>
                </SelectItem>
                {adminUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ? `${u.name} (${u.email})` : u.email}
                    {u.warehouse && u.warehouseId !== warehouse?.id
                      ? ` - Saat ini di: ${u.warehouse.name}`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!hasAdminUsers && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-semibold">Tidak ada user dengan role Admin Warehouse.</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Silakan tambahkan user dengan role Warehouse Admin di menu{" "}
                    <span className="font-medium text-foreground">User Management</span> untuk
                    menugaskannya ke gudang ini.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? "Simpan Perubahan" : "Buat Gudang"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
