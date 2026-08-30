import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { userService } from "@/services/user.service";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Masuk | WPOS - Warehouse & POS System",
  description: "Masuk ke sistem terpadu Warehouse & POS",
};

export default async function SignInPage() {
  const hasUsers = await userService.hasAnyUser();
  if (!hasUsers) {
    redirect("/setup");
  }
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-radial from-background via-muted/40 to-background p-4 md:p-8">
      {/* Decorative background glow */}
      <div className="absolute inset-0 bg-grid-white/[0.02] bg-[size:32px_32px] pointer-events-none" />
      <div className="relative z-10 w-full flex flex-col items-center justify-center max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            WPOS
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-1">
            Warehouse & POS Integrated System
          </p>
        </div>

        <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-xl bg-card/50" />}>
          <LoginForm className="w-full" />
        </Suspense>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Sistem tertutup. Registrasi hanya dapat dilakukan oleh Super Admin.
        </p>
      </div>
    </div>
  );
}
