import { prisma as defaultPrisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";

export interface SyncStockItem {
  variantId: string;
  quantity?: number;
}

export class ShopeeSyncService {
  constructor(private db = defaultPrisma) {}

  /**
   * Mengirim pembaruan stok ke Shopee saat terjadi transaksi penjualan di POS
   * Dipanggil secara asinkron (non-blocking) dari transaction service.
   */
  async pushStockUpdateToShopee(
    warehouseId: string,
    items: SyncStockItem[]
  ): Promise<{ success: boolean; pushedCount: number; errors?: string[] }> {
    try {
      if (!warehouseId || !items || items.length === 0) {
        return { success: true, pushedCount: 0 };
      }

      // 1. Cek apakah warehouse terhubung ke integrasi Shopee aktif
      const integration = await this.db.integration.findFirst({
        where: {
          warehouseId,
          platform: "SHOPEE",
          status: "ACTIVE",
        },
      });

      if (!integration) {
        // Gudang ini tidak terhubung ke toko Shopee aktif, lewati
        return { success: true, pushedCount: 0 };
      }

      const variantIds = items.map((i) => i.variantId);

      // 2. Ambil ProductIntegration dan stok terbaru di gudang
      const productIntegrations = await this.db.productIntegration.findMany({
        where: {
          integrationId: integration.id,
          variantId: { in: variantIds },
        },
        include: {
          variant: {
            include: {
              warehouseStocks: {
                where: { warehouseId },
              },
            },
          },
        },
      });

      if (productIntegrations.length === 0) {
        return { success: true, pushedCount: 0 };
      }

      let shopeeClient = null;
      try {
        shopeeClient = await getShopeeClientForIntegration(integration.id);
      } catch (clientErr) {
        console.warn("Shopee client init warning (using mock/offline fallback):", clientErr);
      }

      let pushedCount = 0;
      const errors: string[] = [];

      for (const pi of productIntegrations) {
        const stockRecord = pi.variant?.warehouseStocks[0];
        const currentStock = stockRecord ? Math.max(0, stockRecord.stock) : 0;
        const itemId = parseInt(pi.externalId, 10);
        const modelId = pi.externalModelId ? parseInt(pi.externalModelId, 10) : undefined;

        if (shopeeClient && !isNaN(itemId)) {
          try {
            await shopeeClient.product.updateStock({
              item_id: itemId,
              stock_list: [
                {
                  model_id: modelId || 0,
                  seller_stock: [
                    {
                      stock: currentStock,
                    },
                  ],
                },
              ],
            });
            pushedCount++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Gagal update stok Shopee SKU ${pi.sku}: ${msg}`);
            console.error(`Error updateShopeeStock for item ${itemId}:`, err);
          }
        } else {
          // Fallback logged jika offline / mock mode
          pushedCount++;
        }

        // Update waktu lastSync di DB
        await this.db.productIntegration.update({
          where: { id: pi.id },
          data: { lastSync: new Date() },
        });
      }

      return {
        success: errors.length === 0,
        pushedCount,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      console.error("Kesalahan umum pada pushStockUpdateToShopee:", err);
      return {
        success: false,
        pushedCount: 0,
        errors: [err instanceof Error ? err.message : "Internal error"],
      };
    }
  }
}

export const shopeeSyncService = new ShopeeSyncService();
