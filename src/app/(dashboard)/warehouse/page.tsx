import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { WarehouseTable } from "@/components/warehouse/warehouse-table";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Warehouse Management - WPOS System",
  description: "Kelola daftar gudang, stok produk, dan penugasan admin gudang",
};

export default function WarehousePage() {
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
            <WarehouseTable />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
