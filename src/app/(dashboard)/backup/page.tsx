"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, Loader2, CalendarIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { addDays, format } from "date-fns";
import { type DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function BackupRestorePage() {
  const [deleteTransactions, setDeleteTransactions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState<DateRange | undefined>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  const handleBackup = async (e: React.MouseEvent) => {
    e.preventDefault(); 
    setBackupOpen(false);
    setIsExporting(true);
    try {
      let url = `/api/backup/export?archive=${deleteTransactions}`;
      if (deleteTransactions && date?.from && date?.to) {
        url += `&from=${date.from.toISOString()}&to=${date.to.toISOString()}`;
      }

      const response = await fetch(url, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Gagal melakukan backup. Pastikan Anda memiliki akses Super Admin.");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = `wpos-backup-${new Date().toISOString().split("T")[0]}.json`;
      if (contentDisposition && contentDisposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]*)"/.exec(contentDisposition);
        if (matches != null && matches[1]) {
          filename = matches[1];
        }
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success("Backup berhasil diunduh!" + (deleteTransactions ? " Data transaksi telah di-archive." : ""));
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan saat melakukan backup.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleRestore = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Pilih file JSON terlebih dahulu.");
      return;
    }

    setRestoreOpen(false);
    setIsRestoring(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Gagal melakukan restore. Pastikan Anda memiliki akses Super Admin.");
      }

      toast.success("Restore berhasil! Data telah dimasukkan ke database.");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan saat restore.");
    } finally {
      setIsRestoring(false);
    }
  };

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
          <div className="mx-auto w-full max-w-7xl space-y-6">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Data Management</h2>
              <p className="text-muted-foreground mt-1">
                Lakukan pencadangan (backup), pengarsipan, dan pemulihan (restore) data. Halaman ini hanya dapat diakses oleh Super Admin.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" /> Export Data (Backup)
                  </CardTitle>
                  <CardDescription>
                    Unduh seluruh isi database ke dalam format JSON.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start space-x-3 p-4 border rounded-md bg-muted/50">
                    <Checkbox 
                      id="archive" 
                      checked={deleteTransactions} 
                      onCheckedChange={(checked) => setDeleteTransactions(checked as boolean)}
                    />
                    <div className="space-y-1 leading-none w-full">
                      <Label htmlFor="archive" className="font-medium cursor-pointer">
                        Bersihkan riwayat transaksi setelah backup
                      </Label>
                      <p className="text-sm text-muted-foreground pt-1">
                        (Archiving) Hapus data transaksi dan mutasi stok untuk menghemat ruang server. Master data (User, Produk, dsb) tidak akan terhapus.
                      </p>

                      {deleteTransactions && (
                        <div className="mt-4 pt-4 border-t">
                          <Field className="w-full">
                            <FieldLabel htmlFor="date-picker-range">Hapus Transaksi Dalam Rentang Waktu</FieldLabel>
                            <Popover>
                              <PopoverTrigger
                                render={
                                  <Button
                                    variant="outline"
                                    id="date-picker-range"
                                    className="w-[300px] justify-start px-2.5 font-normal mt-1"
                                  />
                                }
                              >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {date?.from ? (
                                    date.to ? (
                                      <>
                                        {format(date.from, "dd MMM yyyy")} -{" "}
                                        {format(date.to, "dd MMM yyyy")}
                                      </>
                                    ) : (
                                      format(date.from, "dd MMM yyyy")
                                    )
                                  ) : (
                                    <span>Pilih rentang tanggal</span>
                                  )}
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="range"
                                  defaultMonth={date?.from}
                                  selected={date}
                                  onSelect={setDate}
                                  numberOfMonths={2}
                                />
                              </PopoverContent>
                            </Popover>
                          </Field>
                          <p className="text-sm text-muted-foreground mt-2">
                            Hanya transaksi dan riwayat mutasi stok di antara tanggal tersebut yang akan dihapus.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <AlertDialog open={backupOpen} onOpenChange={setBackupOpen}>
                    <AlertDialogTrigger
                      render={<Button className="w-full" disabled={isExporting} />}
                    >
                      {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Buat Backup
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Backup</AlertDialogTitle>
                        <AlertDialogDescription render={<div />}>
                          <div>
                            <p>Apakah Anda yakin ingin mengunduh backup?</p>
                          </div>
                        </AlertDialogDescription>
                        {deleteTransactions && (
                          <div className="mt-2 text-destructive font-medium flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-sm">
                            <AlertTriangle className="h-5 w-5 shrink-0" />
                            <span>Peringatan: Riwayat transaksi di server akan dihapus!</span>
                          </div>
                        )}
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <Button 
                          variant={deleteTransactions ? "destructive" : "default"} 
                          onClick={handleBackup}
                        >
                          Ya, Buat Backup
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" /> Import Data (Restore)
                  </CardTitle>
                  <CardDescription>
                    Pulihkan data dari file JSON backup Anda sebelumnya.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="file-upload">Upload File Backup (.json)</Label>
                    <Input 
                      id="file-upload" 
                      type="file" 
                      accept=".json" 
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      disabled={isRestoring}
                    />
                  </div>

                  <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
                    <AlertDialogTrigger
                      render={
                        <Button
                          className="w-full"
                          variant="secondary"
                          disabled={isRestoring || !file}
                        />
                      }
                    >
                      {isRestoring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Restore Backup
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Restore</AlertDialogTitle>
                        <AlertDialogDescription render={<div />}>
                          <div>
                            {file ? (
                              <p>Apakah Anda yakin ingin merestore data dari file "{file.name}"? Proses ini akan meng-update master data yang sudah ada dan memasukkan kembali data transaksi.</p>
                            ) : (
                              <span className="text-destructive">
                                Silakan pilih file backup (.json) terlebih dahulu sebelum melanjutkan.
                              </span>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <Button onClick={handleRestore} disabled={!file}>
                          Ya, Restore Data
                        </Button>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
