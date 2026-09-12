"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  RadioIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  XCircleIcon,
  CopyIcon,
  SparklesIcon,
  SaveIcon,
  ShieldCheckIcon,
} from "lucide-react";

// Tipe notifikasi push Shopee yang didukung
const PUSH_EVENT_TYPES = [
  {
    code: 3,
    title: "Order Status Update (Code 3)",
    description: "Notifikasi update status pesanan (dipakai untuk auto-potong stok saat SHIPPED).",
    recommended: true,
  },
  {
    code: 1,
    title: "Shop Authorization (Code 1)",
    description: "Notifikasi saat toko baru berhasil dihubungkan ke aplikasi.",
    recommended: true,
  },
  {
    code: 2,
    title: "Shop Deauthorization (Code 2)",
    description: "Notifikasi saat otorisasi toko dicabut atau dinonaktifkan dari Shopee.",
    recommended: true,
  },
  {
    code: 12,
    title: "Authorization Expiry (Code 12)",
    description: "Peringatan saat masa berlaku token otorisasi toko tersisa 7 hari.",
    recommended: true,
  },
  {
    code: 4,
    title: "Tracking Number Update (Code 4)",
    description: "Notifikasi saat resi/nomor pelacakan pengiriman diperbarui.",
    recommended: false,
  },
  {
    code: 8,
    title: "Reserved Stock Change (Code 8)",
    description: "Notifikasi saat kuota reserved stock di Shopee mengalami perubahan.",
    recommended: false,
  },
];

export function ShopeePushConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [livePushStatus, setLivePushStatus] = useState<string | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<number[]>([1, 2, 3, 12]);
  const [envInfo, setEnvInfo] = useState<{ isUat: boolean; baseDomain: string } | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      setConfigError(null);
      const res = await fetch("/api/shopee/push-config");
      const data = await res.json();

      if (!res.ok) {
        setConfigError(data.error || "Gagal memuat konfigurasi push mechanism Shopee.");
        if (data.env) setEnvInfo(data.env);
        return;
      }

      if (data.env) {
        setEnvInfo(data.env);
      }

      if (data.data) {
        const conf = data.data;
        if (conf.callback_url) {
          setCallbackUrl(conf.callback_url);
        } else {
          // Jika belum diset di Shopee, tawarkan URL webhook aplikasi default
          if (typeof window !== "undefined") {
            setCallbackUrl(`${window.location.origin}/api/shopee/webhook`);
          }
        }

        setLivePushStatus(conf.live_push_status || "Belum Dikonfigurasi");

        if (Array.isArray(conf.push_config_on_list) && conf.push_config_on_list.length > 0) {
          setSelectedEvents(conf.push_config_on_list);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setConfigError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleUseCurrentAppUrl = () => {
    if (typeof window !== "undefined") {
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      const suggested = `${window.location.origin}/api/shopee/webhook`;
      setCallbackUrl(suggested);
      if (isLocal) {
        toast.warning(
          "Catatan: Shopee mengirim test push dari cloud dan tidak dapat menjangkau 'localhost'. Untuk testing lokal, gunakan tunnel publik HTTPS seperti ngrok.",
          { duration: 6000 }
        );
      } else {
        toast.info("Callback URL disesuaikan dengan domain aktif saat ini.");
      }
    }
  };

  const handleCopyUrl = async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      toast.success("Callback URL berhasil disalin ke clipboard.");
    } catch {
      toast.error("Gagal menyalin URL.");
    }
  };

  const handleToggleEvent = (code: number) => {
    setSelectedEvents((prev) => {
      if (prev.includes(code)) {
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const handleSave = async () => {
    const trimmed = callbackUrl.trim();
    if (!trimmed) {
      toast.error("Callback URL tidak boleh kosong.");
      return;
    }

    const isLocal = trimmed.includes("localhost") || trimmed.includes("127.0.0.1");
    if (isLocal) {
      toast.error(
        "Server Shopee tidak dapat mengakses 'localhost' untuk melakukan test push. Gunakan tunneling HTTPS (misal: ngrok http 3000) atau domain publik.",
        { duration: 7000 }
      );
      return;
    }

    if (!trimmed.startsWith("https://")) {
      toast.error("Callback URL harus menggunakan protokol HTTPS (contoh: https://...) sesuai syarat Shopee.");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/shopee/push-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_url: trimmed,
          set_push_config_on: selectedEvents,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi push mechanism");
      }

      toast.success(data.message || "Konfigurasi Push Mechanism Shopee berhasil diperbarui!");
      fetchConfig();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi");
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = () => {
    if (!livePushStatus) return null;
    const status = livePushStatus.toLowerCase();

    if (status === "normal") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white flex items-center gap-1">
          <CheckCircle2Icon className="h-3 w-3" /> Push Aktif: Normal
        </Badge>
      );
    }
    if (status === "warning") {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 flex items-center gap-1">
          <AlertTriangleIcon className="h-3 w-3" /> Push Warning (Tingkat Sukses Rendah)
        </Badge>
      );
    }
    if (status === "suspended") {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircleIcon className="h-3 w-3" /> Push Suspended (Tertahan)
        </Badge>
      );
    }

    return (
      <Badge variant="secondary">
        {livePushStatus}
      </Badge>
    );
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-950/50 text-[#EE4D2D]">
              <RadioIcon className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                Shopee Push Mechanism (Webhook)
                {renderStatusBadge()}
              </CardTitle>
              <CardDescription className="text-xs">
                Menerima notifikasi pesanan dan sinkronisasi otomatis secara real-time dari Shopee Open Platform.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {envInfo && (
              <Badge variant="outline" className="text-xs">
                {envInfo.isUat ? "Mode: Sandbox / UAT" : "Mode: Production"}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={fetchConfig}
              disabled={loading || saving}
              className="h-8"
            >
              <RefreshCwIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {configError && (
          <div className="p-3 text-xs bg-destructive/10 text-destructive rounded-md border border-destructive/20 flex items-start gap-2">
            <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Perhatian Konfigurasi:</p>
              <p>{configError}</p>
              <p className="mt-1 text-muted-foreground">
                Pastikan Partner ID dan Partner Key Shopee sudah dikonfigurasi di Environment Variable.
              </p>
            </div>
          </div>
        )}

        {/* Callback URL Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="callback-url" className="text-xs font-semibold">
              Callback URL (Webhook Endpoint)
            </Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleUseCurrentAppUrl}
                className="h-6 text-[11px] text-[#EE4D2D] hover:text-[#d73211] px-2 py-0"
              >
                <SparklesIcon className="h-3 w-3 mr-1" />
                Gunakan URL Host Aktif
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="callback-url"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://domain-anda.com/api/shopee/webhook"
                className="text-xs font-mono pr-9"
                disabled={loading || saving}
              />
              {callbackUrl && (
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  title="Salin URL"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              size="sm"
              onClick={handleSave}
              disabled={loading || saving || !callbackUrl}
              className="bg-[#EE4D2D] hover:bg-[#d73211] text-white shrink-0"
            >
              <SaveIcon className="h-4 w-4 mr-1.5" />
              {saving ? "Menyimpan..." : "Simpan ke Shopee"}
            </Button>
          </div>
          {(callbackUrl.includes("localhost") || callbackUrl.includes("127.0.0.1")) && (
            <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-200 flex items-start gap-2">
              <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Localhost terdeteksi:</p>
                <p>
                  Shopee mengirimkan <em>test push</em> langsung dari server internet Shopee. Server Shopee tidak dapat menghubungi <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900 font-mono text-[10px]">localhost</code>.
                </p>
                <p className="mt-1 text-muted-foreground">
                  Solusi: Jalankan tunnel publik seperti <strong>ngrok</strong> (<code className="font-mono">ngrok http 3000</code>) atau Cloudflare Tunnel, lalu gunakan URL HTTPS publik yang dihasilkan (misal: <code className="font-mono text-[10px]">https://xxxx.ngrok-free.app/api/shopee/webhook</code>).
                </p>
              </div>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Shopee Open Platform mewajibkan protokol HTTPS dengan respon HTTP 200 cepat (&lt; 3 detik).
          </p>
        </div>

        {/* Push Event Subscriptions */}
        <div className="space-y-2.5 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">
              Event Push yang Diaktifkan
            </Label>
            <span className="text-[11px] text-muted-foreground">
              {selectedEvents.length} event dipilih
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {PUSH_EVENT_TYPES.map((evt) => {
              const isChecked = selectedEvents.includes(evt.code);
              return (
                <div
                  key={evt.code}
                  onClick={() => !loading && !saving && handleToggleEvent(evt.code)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    isChecked
                      ? "border-[#EE4D2D]/40 bg-orange-50/40 dark:bg-orange-950/20"
                      : "border-border/60 hover:bg-accent/40"
                  }`}
                >
                  <Checkbox
                    id={`push-evt-${evt.code}`}
                    checked={isChecked}
                    onCheckedChange={() => handleToggleEvent(evt.code)}
                    disabled={loading || saving}
                    className="mt-0.5 data-[state=checked]:bg-[#EE4D2D] data-[state=checked]:border-[#EE4D2D]"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{evt.title}</span>
                      {evt.recommended && (
                        <Badge variant="secondary" className="text-[9px] py-0 px-1 font-normal text-muted-foreground">
                          Wajib/Direkomendasikan
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {evt.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info footer */}
        <div className="p-2.5 rounded-md bg-muted/40 border border-muted flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            Setiap payload push dari Shopee diamankan dengan tanda tangan HMAC-SHA256 yang divalidasi menggunakan Partner Key aplikasi.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
