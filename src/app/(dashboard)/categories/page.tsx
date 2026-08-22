import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { CategoryTable } from "@/components/categories/category-table";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories Management - WPOS System",
  description: "Kelola struktur kategori produk multi-level dan kode 3 huruf untuk penomoran SKU",
};

export default function CategoriesPage() {
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
            <CategoryTable />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
