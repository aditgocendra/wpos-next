import { Suspense } from "react";
import { SetupForm } from "@/components/auth/setup-form";
import { userService } from "@/services/user.service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setup Awal | WPOS - Warehouse & POS System",
  description: "Inisialisasi sistem WPOS dan pembuatan akun Super Admin pertama",
};

export default async function SetupPage() {
  // Server-side guard: if database already has users, redirect away from setup
  const hasUsers = await userService.hasAnyUser();
  if (hasUsers) {
    redirect("/sign-in");
  }

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-radial from-background via-muted/30 to-background p-4">
      {/* Decorative background grid and ambient lighting */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute -top-40 -left-40 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full flex flex-col items-center justify-center max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            WPOS
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
            Warehouse & POS Integrated System
          </p>
        </div>

        <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-xl bg-card/50" />}>
          <SetupForm />
        </Suspense>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Setup ini hanya dijalankan satu kali saat inisialisasi awal aplikasi.
        </p>
      </div>
    </div>
  );
}
