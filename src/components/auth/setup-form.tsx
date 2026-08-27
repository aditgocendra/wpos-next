"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export function SetupForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password !== confirmPassword) {
      setErrorMessage("Konfirmasi kata sandi tidak cocok!");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Kata sandi minimal harus 6 karakter.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Gagal membuat akun Super Admin.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push("/sign-in");
        router.refresh();
      }, 2000);
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi saat inisialisasi akun.");
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md border-border/60 shadow-2xl backdrop-blur-md p-0 overflow-hidden"
      >
        <Card className="border-0 shadow-none">
          <CardHeader className="space-y-2 text-center pb-4 pt-6 bg-radial from-primary/10 via-background to-background">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg mb-1 ring-4 ring-primary/20 animate-in zoom-in-75 duration-300">
              <ShieldCheck className="size-7" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-2xl font-bold tracking-tight flex items-center justify-center gap-1.5">
                Setup Awal WPOS <Sparkles className="size-4 text-amber-500 fill-amber-500 inline" />
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                Selamat datang! Buat akun Super Admin utama untuk mengelola sistem Anda.
              </DialogDescription>
            </DialogHeader>
          </CardHeader>

          <CardContent className="p-6 pt-2">
            {isSuccess ? (
              <div className="py-6 text-center space-y-3 animate-in fade-in zoom-in-95 duration-300">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-8" />
                </div>
                <h3 className="text-lg font-semibold">Super Admin Berhasil Dibuat!</h3>
                <p className="text-xs text-muted-foreground">
                  Sistem siap digunakan. Mengalihkan Anda ke halaman login...
                </p>
                <div className="flex justify-center pt-2">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive animate-in fade-in-50 duration-200"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="setup-name">Nama Lengkap</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="setup-name"
                      type="text"
                      placeholder="Super Administrator"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-email">Email Administrator</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="setup-email"
                      type="email"
                      placeholder="admin@wpos.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-password">Kata Sandi</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="setup-password"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="setup-confirm-password">Konfirmasi Kata Sandi</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="setup-confirm-password"
                      type="password"
                      placeholder="Ulangi kata sandi"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-9"
                      disabled={isLoading}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 font-medium transition-all shadow-md mt-2"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Membuat Akun Super Admin...
                    </>
                  ) : (
                    "Buat Akun & Inisialisasi Sistem"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
