"use client";

import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2Icon } from "lucide-react";

interface OpnameDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opnameNumber: string;
  onConfirm: () => Promise<void>;
  loading: boolean;
}

export function OpnameDeleteDialog({
  open,
  onOpenChange,
  opnameNumber,
  onConfirm,
  loading,
}: OpnameDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Draft Stock Opname</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus draft Stock Opname{" "}
            <span className="font-semibold text-foreground">
              {opnameNumber}
            </span>
            ? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Menghapus...
              </>
            ) : (
              "Hapus Draft"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
