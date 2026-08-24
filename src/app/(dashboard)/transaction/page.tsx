import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TransactionTable } from "@/components/transaction/transaction-table";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Transactions (Cashier) - WPOS System",
  description: "Kelola transaksi kasir dan riwayat penjualan produk",
};

export default function TransactionPage() {
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
          <div className="mx-auto w-full max-w-9xl">
            <TransactionTable />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
