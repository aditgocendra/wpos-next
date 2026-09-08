import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SyncView } from "@/components/integrations/sync-view";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sinkronisasi Produk Shopee - WPOS System",
  description: "Sinkronisasi produk massal dari Shopee ke sistem POS WPOS.",
};

interface SyncPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SyncPage({ params }: SyncPageProps) {
  const { id } = await params;

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
            <SyncView integrationId={id} />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
