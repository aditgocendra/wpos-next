"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShoppingBagIcon,
  RefreshCwIcon,
  WarehouseIcon,
  Trash2Icon,
  ExternalLinkIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
} from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string | null;
}

interface Integration {
  id: string;
  warehouseId: string;
  platform: string;
  shopId: string | null;
  status: string;
  tokenExpire: string | null;
  createdAt: string;
  warehouse: Warehouse;
  _count: {
    products: number;
    syncJobs: number;
  };
}

export function IntegrationsView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Handle URL feedback query params (e.g. from OAuth redirect)
  useEffect(() => {
    const successMsg = searchParams.get("success");
    const errorMsg = searchParams.get("error");
    if (successMsg) {
      toast.success(successMsg);
      router.replace("/integrations");
    }
    if (errorMsg) {
      toast.error(errorMsg);
      router.replace("/integrations");
    }
  }, [searchParams, router]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shopee/integrations");
      if (!res.ok) throw new Error("Gagal memuat data integrasi");
      const data = await res.json();
      setIntegrations(data.integrations || []);
      setWarehouses(data.warehouses || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const handleConnectShopee = async () => {
    try {
      setConnecting(true);
      const res = await fetch("/api/shopee/auth?action=get_auth_url");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Gagal mendapatkan link otorisasi Shopee");
      }
    } catch {
      toast.error("Gagal memulai koneksi ke Shopee");
    } finally {
      setConnecting(false);
    }
  };

  const handleWarehouseChange = async (integrationId: string, warehouseId: string) => {
    try {
      setUpdatingId(integrationId);
      const res = await fetch("/api/shopee/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: integrationId, warehouseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah gudang");

      toast.success("Gudang berhasil dipetakan ke toko ini");
      fetchIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah gudang");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleStatus = async (integration: Integration) => {
    const newStatus = integration.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setUpdatingId(integration.id);
      const res = await fetch("/api/shopee/integrations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: integration.id, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengubah status");

      toast.success(`Status integrasi diubah menjadi ${newStatus}`);
      fetchIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin memutuskan koneksi toko ini?")) return;

    try {
      setUpdatingId(id);
      const res = await fetch(`/api/shopee/integrations?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus integrasi");

      toast.success("Toko Shopee berhasil diputuskan");
      fetchIntegrations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memutuskan koneksi");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrasi E-Commerce</h1>
          <p className="text-sm text-muted-foreground">
            Sinkronisasi stok dua arah antara gudang fisik WPOS dan toko online Shopee.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchIntegrations}
            disabled={loading}
          >
            <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Muat Ulang
          </Button>
          <Button
            size="sm"
            onClick={handleConnectShopee}
            disabled={connecting}
            className="bg-[#EE4D2D] hover:bg-[#d73211] text-white"
          >
            <ShoppingBagIcon className="mr-2 h-4 w-4" />
            {connecting ? "Menghubungkan..." : "Hubungkan Toko Shopee"}
          </Button>
        </div>
      </div>

      {/* Rules Notice */}
      <Card className="border-orange-200 bg-orange-50/50 dark:border-orange-950 dark:bg-orange-950/20">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertCircleIcon className="h-5 w-5 text-[#EE4D2D] shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 text-muted-foreground">
            <p className="font-semibold text-foreground">Ketentuan Sinkronisasi Otomatis:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>1 Toko Shopee dipetakan secara eksklusif ke 1 Gudang.</li>
              <li>Penjualan di POS langsung memotong stok di Shopee (pencocokan SKU).</li>
              <li>Pesanan dari Shopee hanya memotong stok gudang POS setelah diserahkan ke kurir (Status: SHIPPED).</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Table / List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Toko Terhubung ({integrations.length})</CardTitle>
          <CardDescription>
            Kelola toko Shopee aktif dan sesuaikan gudang sumber stok masing-masing toko.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Memuat data integrasi...
            </div>
          ) : integrations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingBagIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <div className="space-y-1">
                <p className="font-medium text-foreground">Belum ada toko Shopee yang terhubung</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Hubungkan toko Shopee Anda untuk mulai mengotomatisasi sinkronisasi produk dan stok.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleConnectShopee}
                className="bg-[#EE4D2D] hover:bg-[#d73211] text-white"
              >
                <ShoppingBagIcon className="mr-2 h-4 w-4" />
                Hubungkan Sekarang
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform & Toko</TableHead>
                  <TableHead>Pemetaan Gudang</TableHead>
                  <TableHead>Produk Terhubung</TableHead>
                  <TableHead>Status Integrasi</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-[#EE4D2D] text-white hover:bg-[#EE4D2D]">
                          {item.platform}
                        </Badge>
                        <div>
                          <p className="text-sm font-semibold">
                            Shop ID: {item.shopId || "Belum Terhubung"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Terhubung sejak: {new Date(item.createdAt).toLocaleDateString("id-ID")}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[200px]">
                        <WarehouseIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          defaultValue={item.warehouseId}
                          onValueChange={(val) => {
                            if (val) handleWarehouseChange(item.id, val);
                          }}
                          disabled={updatingId === item.id}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Pilih Gudang" />
                          </SelectTrigger>
                          <SelectContent>
                            {warehouses.map((wh) => (
                              <SelectItem key={wh.id} value={wh.id} className="text-xs">
                                {wh.name} {wh.code ? `(${wh.code})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-sm font-medium">
                        {item._count?.products || 0} SKU
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={item.status === "ACTIVE" ? "default" : "secondary"}
                        className={
                          item.status === "ACTIVE"
                            ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                            : ""
                        }
                      >
                        {item.status === "ACTIVE" ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2Icon className="h-3 w-3" /> Aktif
                          </span>
                        ) : (
                          "Non-Aktif"
                        )}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => router.push(`/integrations/${item.id}/sync`)}
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5 mr-1" />
                          Sync Produk
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          disabled={updatingId === item.id}
                          onClick={() => handleToggleStatus(item)}
                        >
                          {item.status === "ACTIVE" ? "Matikan" : "Aktifkan"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                          disabled={updatingId === item.id}
                          onClick={() => handleDelete(item.id)}
                        >
                          <Trash2Icon className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
