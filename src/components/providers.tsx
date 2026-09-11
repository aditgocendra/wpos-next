"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CategoryProvider } from "@/providers/category-provider";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CategoryProvider>
        <TooltipProvider>
          {children}
          <Toaster richColors position="top-right" closeButton />
        </TooltipProvider>
      </CategoryProvider>
    </SessionProvider>
  );
}
