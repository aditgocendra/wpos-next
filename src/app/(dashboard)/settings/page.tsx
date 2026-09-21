"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { SettingsIcon, RefreshCwIcon, SaveIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [shopeeWebhookEnabled, setShopeeWebhookEnabled] = useState(true); // Default true

  // Ensure only SUPER_ADMIN can see the real settings (or API will reject anyway)
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Gagal mengambil pengaturan");
      const { data } = await res.json();
      
      // Parse SHOPEE_WEBHOOK_ENABLED
      if (data["SHOPEE_WEBHOOK_ENABLED"] !== undefined) {
        setShopeeWebhookEnabled(data["SHOPEE_WEBHOOK_ENABLED"] === "true");
      }
    } catch (error) {
      console.error(error);
      toast.error("Gagal memuat pengaturan sistem");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWebhook = async (checked: boolean) => {
    try {
      setSaving(true);
      setShopeeWebhookEnabled(checked);
      
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "SHOPEE_WEBHOOK_ENABLED",
          value: checked ? "true" : "false",
          description: "Mengizinkan server menerima dan memproses data webhook dari Shopee",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menyimpan pengaturan");
      }

      toast.success(
        `Webhook Shopee berhasil ${checked ? "diaktifkan" : "dimatikan"}.`
      );
    } catch (error: any) {
      console.error(error);
      // Revert state if failed
      setShopeeWebhookEnabled(!checked);
      toast.error(error.message || "Gagal mengubah pengaturan");
    } finally {
      setSaving(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <SidebarProvider
        style={
          {
            "--sidebar-width": "calc(var(--spacing) * 72)",
            "--header-height": "calc(var(--spacing) * 12)",
          } as React.CSSProperties
        }
      >
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4 text-center">
              <SettingsIcon className="size-12 text-muted-foreground/30" />
              <div className="space-y-1">
                <h2 className="text-xl font-bold">Akses Ditolak</h2>
                <p className="text-sm text-muted-foreground">
                  Hanya Super Admin yang dapat mengakses halaman pengaturan sistem.
                </p>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col p-4 md:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-9xl space-y-4">
            <div className="flex items-center justify-between space-y-2">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Pengaturan Sistem</h2>
                <p className="text-muted-foreground">
                  Kelola preferensi dan pengaturan global aplikasi di sini.
                </p>
              </div>
            </div>

            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Integrasi Webhook</CardTitle>
                  <CardDescription>
                    Atur penerimaan notifikasi *real-time* dari platform eksternal.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCwIcon className="size-4 animate-spin" />
                      <span>Memuat status...</span>
                    </div>
                  ) : (
                    <div className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm">
                      <div className="space-y-0.5">
                        <Label className="text-base font-semibold">
                          Terima Webhook Shopee
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Jika dimatikan, sistem akan langsung menolak/mengabaikan notifikasi perubahan stok dari Shopee tanpa memprosesnya.
                        </p>
                      </div>
                      <Switch
                        checked={shopeeWebhookEnabled}
                        onCheckedChange={handleToggleWebhook}
                        disabled={saving}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
