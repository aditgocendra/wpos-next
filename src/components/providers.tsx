"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CategoryProvider } from "@/providers/category-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CategoryProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </CategoryProvider>
    </SessionProvider>
  );
}
