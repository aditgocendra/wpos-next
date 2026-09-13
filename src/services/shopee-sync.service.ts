import { prisma as defaultPrisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";

export interface SyncStockItem {
  variantId: string;
  sku?: string;
  quantity?: number;
}

export class ShopeeSyncService {
  constructor(private db = defaultPrisma) {}

  /**
   * Mengirim pembaruan stok ke Shopee saat terjadi transaksi penjualan di POS atau event pesanan online.
   * Mendorong stok terbaru dari gudang ke semua toko Shopee aktif yang terhubung.
   */
  async pushStockUpdateToShopee(
    warehouseId: string,
    items: SyncStockItem[],
    options?: { allowInactive?: boolean; excludeIntegrationId?: string }
  ): Promise<{ success: boolean; pushedCount: number; errors?: string[] }> {
    try {
      if (!warehouseId || !items || items.length === 0) {
        return { success: true, pushedCount: 0 };
      }

      // 1. Cek semua integrasi Shopee yang terhubung ke warehouse ini
      const integrations = await this.db.integration.findMany({
        where: {
          warehouseId,
          platform: "SHOPEE",
          ...(options?.allowInactive ? {} : { status: "ACTIVE" }),
          ...(options?.excludeIntegrationId
            ? { id: { not: options.excludeIntegrationId } }
            : {}),
        },
      });

      if (!integrations || integrations.length === 0) {
        // Gudang ini tidak terhubung ke toko Shopee aktif, lewati
        return { success: true, pushedCount: 0 };
      }

      const variantIds = items.map((i) => i.variantId).filter(Boolean);
      const skus = items
        .map((i) => (i.sku ? i.sku.trim() : ""))
        .filter((s): s is string => Boolean(s));

      let totalPushedCount = 0;
      const allErrors: string[] = [];

      for (const integration of integrations) {
        // Aktifkan toko secara otomatis jika sync manual dipanggil dan status masih INACTIVE
        if (options?.allowInactive && integration.status === "INACTIVE") {
          try {
            await this.db.integration.update({
              where: { id: integration.id },
              data: { status: "ACTIVE" },
            });
          } catch (updateErr) {
            console.warn("Gagal update status integration:", updateErr);
          }
        }

        // 2. Ambil ProductIntegration dan stok terbaru di gudang untuk toko ini
        const productIntegrations = await this.db.productIntegration.findMany({
          where: {
            integrationId: integration.id,
            OR: [
              { variantId: { in: variantIds } },
              ...(skus.length > 0 ? [{ sku: { in: skus } }] : []),
            ],
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
          continue;
        }

        let shopeeClient = null;
        try {
          shopeeClient = await getShopeeClientForIntegration(integration.id);
        } catch (clientErr) {
          const clientErrMsg =
            clientErr instanceof Error ? clientErr.message : String(clientErr);
          allErrors.push(
            `Gagal inisialisasi koneksi Shopee (Shop: ${integration.shopId}): ${clientErrMsg}`
          );
          console.warn(
            `Shopee client init warning for shop ${integration.shopId}:`,
            clientErr
          );
        }

        // 3. Kelompokkan per externalId (item_id Shopee) untuk efisiensi batch update
        const groupedByItemId = new Map<
          number,
          Array<{
            piId: string;
            sku: string | null;
            modelId: number;
            stock: number;
          }>
        >();

        for (const pi of productIntegrations) {
          const itemId = parseInt(pi.externalId, 10);
          if (isNaN(itemId)) continue;

          const stockRecord = pi.variant?.warehouseStocks[0];
          const currentStock = stockRecord ? Math.max(0, stockRecord.stock) : 0;
          const modelId = pi.externalModelId ? parseInt(pi.externalModelId, 10) : 0;

          const list = groupedByItemId.get(itemId) || [];
          list.push({
            piId: pi.id,
            sku: pi.sku,
            modelId: isNaN(modelId) ? 0 : modelId,
            stock: currentStock,
          });
          groupedByItemId.set(itemId, list);
        }

        // 4. Kirim update stok ke Shopee per item_id
        for (const [itemId, variantList] of groupedByItemId.entries()) {
          if (shopeeClient) {
            try {
              const res = await shopeeClient.product.updateStock({
                item_id: itemId,
                stock_list: variantList.map((v) => ({
                  model_id: v.modelId,
                  seller_stock: [{ stock: v.stock }],
                })),
              });

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const resData = (res as any)?.response || res;
              if (resData?.failure_list && resData.failure_list.length > 0) {
                const failureList = resData.failure_list as Array<{ failed_reason?: string }>;
                const failedReasons = failureList
                  .map((f) => f.failed_reason || "Gagal update stok di Shopee")
                  .join("; ");
                throw new Error(failedReasons);
              }

              totalPushedCount += variantList.length;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const skuList = variantList.map((v) => v.sku).filter(Boolean).join(", ");
              allErrors.push(
                `Gagal update stok Shopee (Shop: ${integration.shopId}) Item ${itemId} (SKU: ${skuList || "N/A"}): ${msg}`
              );
              console.error(`Error updateShopeeStock for item ${itemId}:`, err);
            }
          } else if (process.env.SHOPEE_USE_MOCK === "true") {
            // Fallback jika offline / mock mode
            totalPushedCount += variantList.length;
          }

          // Perbarui timestamp lastSync di DB
          for (const v of variantList) {
            try {
              await this.db.productIntegration.update({
                where: { id: v.piId },
                data: { lastSync: new Date() },
              });
            } catch (updatePiErr) {
              console.warn(`Gagal memperbarui lastSync untuk ProductIntegration ${v.piId}:`, updatePiErr);
            }
          }
        }
      }

      return {
        success: allErrors.length === 0,
        pushedCount: totalPushedCount,
        errors: allErrors.length > 0 ? allErrors : undefined,
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

  /**
   * Memproses pesanan Shopee yang telah diserahkan ke jasa pengiriman (SHIPPED):
   * 1. Memeriksa idempotensi (mencegah double-deduction jika webhook mengirim retry).
   * 2. Menemukan warehouseId yang terhubung dengan toko penerima pesanan.
   * 3. Mengurangi stok produk varian di gudang secara ACID (Prisma $transaction).
   * 4. Merekam riwayat pekerjaan di SyncJob sebagai penanda idempotensi.
   * 5. Mendorong sisa stok terbaru di gudang tersebut ke seluruh toko Shopee aktif yang terhubung (Multi-Shop Sync).
   */
  async processShippedOrder(params: {
    shopId: string;
    orderSn: string;
    items?: Array<{
      itemId?: string | number;
      modelId?: string | number;
      sku?: string;
      quantity?: number;
    }>;
  }): Promise<{
    success: boolean;
    skipped?: boolean;
    message: string;
    deductions: string[];
    syncedStoresCount?: number;
  }> {
    try {
      const { shopId, orderSn } = params;
      if (!shopId || !orderSn) {
        return {
          success: false,
          message: "shopId dan orderSn wajib diisi",
          deductions: [],
        };
      }

      // 1. Cari integrasi toko Shopee penerima order
      const integration = await this.db.integration.findFirst({
        where: {
          shopId: String(shopId),
        },
        include: {
          warehouse: true,
        },
      });

      if (!integration) {
        return {
          success: false,
          message: `Integrasi Shopee untuk shopId ${shopId} tidak ditemukan.`,
          deductions: [],
        };
      }

      if (!integration.warehouseId || !integration.warehouse) {
        return {
          success: false,
          message: `Toko Shopee (Shop ID: ${shopId}) belum dipetakan ke gudang.`,
          deductions: [],
        };
      }

      const warehouseId = integration.warehouseId;
      const warehouseName = integration.warehouse.name;

      // 2. Cek Idempotency: apakah order ini sudah pernah diproses potong stoknya
      const alreadyProcessed = await this.db.syncJob.findFirst({
        where: {
          integrationId: integration.id,
          type: "ORDER_SHIPPED",
          errorMessage: orderSn,
          status: "COMPLETED",
        },
      });

      if (alreadyProcessed) {
        return {
          success: true,
          skipped: true,
          message: `Pesanan #${orderSn} sudah pernah diproses sebelumnya. Pemotongan stok dilewati.`,
          deductions: [],
        };
      }

      // 3. Kumpulkan rincian item pesanan
      let itemsToDeduct = params.items || [];

      // Jika webhook payload tidak menyertakan daftar item, fetch melalui Open API Shopee
      if (itemsToDeduct.length === 0) {
        try {
          const shopeeClient = await getShopeeClientForIntegration(integration.id);
          const detailRes = await shopeeClient.order.getOrderDetail({
            order_sn_list: [orderSn],
            response_optional_fields: "item_list",
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detailData = (detailRes as any)?.response || detailRes;
          const orderDetail = detailData?.order_list?.[0];
          const itemList = orderDetail?.item_list || [];

          itemsToDeduct = itemList.map(
            (it: {
              item_id?: number;
              model_id?: number;
              model_sku?: string;
              item_sku?: string;
              model_quantity_purchased?: number;
            }) => ({
              itemId: it.item_id,
              modelId: it.model_id,
              sku: (it.model_sku || it.item_sku || "").trim(),
              quantity: it.model_quantity_purchased || 1,
            })
          );
        } catch (err) {
          console.warn(`Gagal fetch order detail untuk #${orderSn}:`, err);
        }
      }

      if (itemsToDeduct.length === 0) {
        return {
          success: false,
          message: `Tidak ditemukan rincian item untuk pesanan #${orderSn}`,
          deductions: [],
        };
      }

      // 4. Potong stok produk di gudang secara transaksional ($transaction)
      const deductionLogs: string[] = [];
      const deductedVariants: Array<{ variantId: string; sku?: string }> = [];

      const executeInTx = async (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fn: (tx: any) => Promise<void>
      ) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (typeof (this.db as any).$transaction === "function") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (this.db as any).$transaction(fn);
        }
        return fn(this.db);
      };

      await executeInTx(async (tx) => {
        for (const item of itemsToDeduct) {
          let variant = null;

          // Cari berdasarkan SKU lokal (case-insensitive & trimmed)
          if (item.sku && item.sku.trim()) {
            variant = await tx.productVariant.findFirst({
              where: {
                sku: {
                  equals: item.sku.trim(),
                  mode: "insensitive",
                },
              },
              include: { product: true },
            });
          }

          // Fallback: cari lewat mapping ProductIntegration jika SKU Shopee kosong atau berbeda
          if (!variant && item.itemId) {
            const pi = await tx.productIntegration.findFirst({
              where: {
                integrationId: integration.id,
                externalId: String(item.itemId),
                ...(item.modelId ? { externalModelId: String(item.modelId) } : {}),
                variantId: { not: null },
              },
              include: {
                variant: {
                  include: { product: true },
                },
              },
            });
            if (pi?.variant) {
              variant = pi.variant;
            }
          }

          if (!variant) {
            deductionLogs.push(
              `SKU "${item.sku || `ItemID ${item.itemId}`}" tidak ditemukan pada database produk lokal`
            );
            continue;
          }

          const orderQty = Math.max(1, Number(item.quantity) || 1);

          // Ambil stok saat ini di gudang terkait
          const currentStockRecord = await tx.productVariantStock.findUnique({
            where: {
              variantId_warehouseId: {
                variantId: variant.id,
                warehouseId,
              },
            },
          });

          const currentQty = currentStockRecord ? currentStockRecord.stock : 0;
          const newStock = Math.max(0, currentQty - orderQty);

          // Update/upsert stok di gudang
          const updatedStock = await tx.productVariantStock.upsert({
            where: {
              variantId_warehouseId: {
                variantId: variant.id,
                warehouseId,
              },
            },
            update: {
              stock: newStock,
            },
            create: {
              variantId: variant.id,
              warehouseId,
              stock: newStock,
            },
          });

          deductedVariants.push({ variantId: variant.id, sku: variant.sku });
          deductionLogs.push(
            `Stok SKU "${variant.sku}" (${variant.product?.name || "Produk"}) di gudang "${warehouseName}" berkurang ${orderQty} (${currentQty} -> ${updatedStock.stock}) untuk pesanan #${orderSn}`
          );
        }

        // Catat log pemrosesan pesanan untuk idempotency dalam transaksi yang sama
        await tx.syncJob.create({
          data: {
            integrationId: integration.id,
            type: "ORDER_SHIPPED",
            status: "COMPLETED",
            totalItems: itemsToDeduct.length,
            processedItems: deductedVariants.length,
            errorMessage: orderSn,
          },
        });
      });

      // 5. Multi-Shop Sync: Sinkronkan sisa stok baru ke SEMUA toko Shopee aktif yang terhubung dengan gudang ini
      let syncedStoresCount = 0;
      if (deductedVariants.length > 0) {
        const syncResult = await this.pushStockUpdateToShopee(
          warehouseId,
          deductedVariants,
          { allowInactive: false }
        );
        syncedStoresCount = syncResult.pushedCount;
      }

      return {
        success: true,
        message: `Berhasil memproses pesanan #${orderSn}. ${deductedVariants.length} varian dipotong dari gudang "${warehouseName}" dan stok telah disinkronkan ke toko Shopee.`,
        deductions: deductionLogs,
        syncedStoresCount,
      };
    } catch (err) {
      console.error("Error pada processShippedOrder:", err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "Internal error",
        deductions: [],
      };
    }
  }
}

export const shopeeSyncService = new ShopeeSyncService();
