import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { OpnameDetail } from "@/components/opname/opname-detail";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Detail Stock Opname - WPOS System",
  description: "Lihat rincian hasil audit fisik dan selisih stok gudang",
};

export default async function OpnameDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

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
            <OpnameDetail id={id} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
