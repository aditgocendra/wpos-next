"use client";

import * as React from "react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Maximize2Icon, ExternalLinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageZoomDialogProps {
  src: string | null | undefined;
  alt?: string;
  title?: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageZoomDialog({
  src,
  alt = "Gambar Produk",
  title = "Pratinjau Gambar",
  subtitle,
  open,
  onOpenChange,
}: ImageZoomDialogProps) {
  if (!src) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] p-0 overflow-hidden border-border bg-background">
        <DialogHeader className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="text-base font-semibold">
                {title}
              </DialogTitle>
              {subtitle && (
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {subtitle}
                </DialogDescription>
              )}
            </div>
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Buka gambar di tab baru"
            >
              <ExternalLinkIcon className="size-4" />
            </a>
          </div>
        </DialogHeader>

        <div className="relative w-full h-[60vh] max-h-[500px] min-h-[300px] bg-muted/30 flex items-center justify-center p-4">
          <Image
            src={src}
            alt={alt}
            fill
            unoptimized
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-contain p-2"
            priority
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
