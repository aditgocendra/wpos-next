import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OpnameForm } from "@/components/opname/opname-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buat Stock Opname - WPOS System",
  description: "Form input audit fisik stok dan penyesuaian saldo gudang",
};

export default function CreateOpnamePage() {
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
          <div className="mx-auto w-full max-w-7xl">
            <OpnameForm />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
