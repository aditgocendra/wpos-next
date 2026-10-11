import { prisma as defaultPrisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";

export interface SyncStockItem {
  variantId: string;
  sku?: string;
  quantity?: number;
}

export interface PushStockUpdateOptions {
  allowInactive?: boolean;
  excludeIntegrationId?: string;
  mode?: "ABSOLUTE" | "DELTA";
  deltaType?: "DECREMENT" | "INCREMENT";
}

export class ShopeeSyncService {
  constructor(private db = defaultPrisma) {}

  /**
   * Mengirim pembaruan stok ke Shopee saat terjadi transaksi penjualan di POS atau event pesanan online.
   * Mendukung mode ABSOLUTE (push stok gudang) atau DELTA (decrement/increment relatif berdasarkan quantity).
   */
  async pushStockUpdateToShopee(
    warehouseId: string,
    items: SyncStockItem[],
    options?: PushStockUpdateOptions
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

      const deltaQtyByVariantId = new Map<string, number>();
      const deltaQtyBySku = new Map<string, number>();
      for (const it of items) {
        const qty = Math.max(1, Number(it.quantity) || 1);
        if (it.variantId) {
          deltaQtyByVariantId.set(
            it.variantId,
            (deltaQtyByVariantId.get(it.variantId) || 0) + qty
          );
        }
        if (it.sku) {
          const trimmed = it.sku.trim();
          if (trimmed) {
            deltaQtyBySku.set(
              trimmed,
              (deltaQtyBySku.get(trimmed) || 0) + qty
            );
          }
        }
      }

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
            variantId: string | null;
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
            variantId: pi.variantId,
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
              let stockToUpdateList: Array<{
                model_id: number;
                seller_stock: [{ stock: number }];
              }> = [];

              if (options?.mode === "DELTA") {
                const deltaType = options.deltaType || "DECREMENT";
                const hasModels = variantList.some((v) => v.modelId > 0);

                const currentShopeeStockByModelId = new Map<number, number>();
                let currentShopeeItemStock: number | null = null;

                if (hasModels) {
                  try {
                    const modelRes = await shopeeClient.product.getModelList({ item_id: itemId });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const modelData = (modelRes as any)?.response || modelRes;
                    const models = modelData?.model || [];
                    for (const m of models) {
                      const avail =
                        m.stock_info_v2?.summary_info?.total_available_stock ??
                        m.stock_info_v2?.seller_stock?.[0]?.stock ??
                        0;
                      currentShopeeStockByModelId.set(Number(m.model_id), avail);
                    }
                  } catch (modelErr) {
                    console.warn(`Gagal getModelList untuk item ${itemId}:`, modelErr);
                  }
                }

                if (variantList.some((v) => v.modelId === 0)) {
                  try {
                    const baseRes = await shopeeClient.product.getItemBaseInfo({
                      item_id_list: [itemId],
                    });
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const baseData = (baseRes as any)?.response || baseRes;
                    const itemList = baseData?.item_list || baseData?.item || [];
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const foundItem = itemList.find((i: any) => Number(i.item_id) === itemId);
                    if (foundItem) {
                      currentShopeeItemStock =
                        foundItem.stock_info_v2?.summary_info?.total_available_stock ??
                        foundItem.stock_info_v2?.seller_stock?.[0]?.stock ??
                        0;
                    }
                  } catch (baseErr) {
                    console.warn(`Gagal getItemBaseInfo untuk item ${itemId}:`, baseErr);
                  }
                }

                stockToUpdateList = variantList.map((v) => {
                  let currentShopeeStock = 0;
                  if (v.modelId > 0 && currentShopeeStockByModelId.has(v.modelId)) {
                    currentShopeeStock = currentShopeeStockByModelId.get(v.modelId)!;
                  } else if (v.modelId === 0 && currentShopeeItemStock !== null) {
                    currentShopeeStock = currentShopeeItemStock;
                  } else {
                    currentShopeeStock = v.stock;
                  }

                  const deltaQty =
                    (v.variantId ? deltaQtyByVariantId.get(v.variantId) : undefined) ??
                    (v.sku ? deltaQtyBySku.get(v.sku) : undefined) ??
                    1;

                  const targetStock =
                    deltaType === "INCREMENT"
                      ? currentShopeeStock + deltaQty
                      : Math.max(0, currentShopeeStock - deltaQty);

                  return {
                    model_id: v.modelId,
                    seller_stock: [{ stock: targetStock }],
                  };
                });
              } else {
                stockToUpdateList = variantList.map((v) => ({
                  model_id: v.modelId,
                  seller_stock: [{ stock: v.stock }],
                }));
              }

              const res = await shopeeClient.product.updateStock({
                item_id: itemId,
                stock_list: stockToUpdateList,
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
          type: { in: ["ORDER_SHIPPED", "ORDER_DEDUCTION"] },
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
      const deductedVariants: SyncStockItem[] = [];

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

          deductedVariants.push({
            variantId: variant.id,
            sku: variant.sku,
            quantity: orderQty,
          });
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

        // Simpan snapshot rincian item yang dipotong untuk cadangan restock jika API Shopee offline/gagal saat pembatalan
        await tx.syncJob.create({
          data: {
            integrationId: integration.id,
            type: "ORDER_DEDUCTION_ITEMS",
            status: "COMPLETED",
            totalItems: itemsToDeduct.length,
            processedItems: deductedVariants.length,
            errorMessage: `${orderSn}::${JSON.stringify(itemsToDeduct)}`,
          },
        });
      });

      // 5. Multi-Shop Sync: Sinkronkan sisa stok baru ke toko Shopee lain yang terhubung dengan gudang ini
      // KECUALI toko asal pesanan (integration.id), karena stok toko asal sudah dipotong otomatis oleh marketplace Shopee
      let syncedStoresCount = 0;
      if (deductedVariants.length > 0) {
        const syncResult = await this.pushStockUpdateToShopee(
          warehouseId,
          deductedVariants,
          {
            allowInactive: false,
            excludeIntegrationId: integration.id,
            mode: "DELTA",
            deltaType: "DECREMENT",
          }
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

  /**
   * Alias untuk processShippedOrder agar mencakup pesanan dari status READY_TO_SHIP maupun PROCESSED
   */
  async processOrderDeduction(params: {
    shopId: string;
    orderSn: string;
    items?: Array<{
      itemId?: string | number;
      modelId?: string | number;
      sku?: string;
      quantity?: number;
    }>;
  }) {
    return this.processShippedOrder(params);
  }

  /**
   * Memproses pesanan Shopee yang dibatalkan (CANCELLED):
   * 1. Validasi integrasi toko Shopee penerima order dan gudang terkait.
   * 2. Validasi idempotensi:
   *    - Cek apakah order ini pernah dipotong stoknya (SyncJob ORDER_SHIPPED atau ORDER_DEDUCTION).
   *      Jika TIDAK PERNAH dipotong stoknya, restock dilewati (skipped: true) untuk mencegah penggelembungan stok fiktif.
   *    - Cek apakah order ini sudah pernah di-restock (SyncJob ORDER_CANCELLED atau ORDER_RESTOCK).
   *      Jika SUDAH PERNAH di-restock, restock dilewati (skipped: true).
   * 3. Mengumpulkan item pesanan (dari payload atau fetch API Shopee getOrderDetail).
   * 4. Mengembalikan stok produk varian ke gudang terkait secara transaksional ($transaction).
   * 5. Merekam riwayat pekerjaan di SyncJob sebagai penanda idempotensi restock (type: ORDER_CANCELLED).
   * 6. Multi-Shop Sync: Mendorong stok terbaru yang bertambah di gudang ke SEMUA toko Shopee aktif yang terhubung.
   */
  async processCancelledOrder(params: {
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
    restocks: string[];
    syncedStoresCount?: number;
  }> {
    try {
      const { shopId, orderSn } = params;
      if (!shopId || !orderSn) {
        return {
          success: false,
          message: "shopId dan orderSn wajib diisi",
          restocks: [],
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
          restocks: [],
        };
      }

      if (!integration.warehouseId || !integration.warehouse) {
        return {
          success: false,
          message: `Toko Shopee (Shop ID: ${shopId}) belum dipetakan ke gudang.`,
          restocks: [],
        };
      }

      const warehouseId = integration.warehouseId;
      const warehouseName = integration.warehouse.name;

      // 2. Cek Idempotensi
      // A. Cek apakah pesanan ini pernah dipotong stoknya sebelumnya
      const deductionJob = await this.db.syncJob.findFirst({
        where: {
          integrationId: integration.id,
          type: { in: ["ORDER_SHIPPED", "ORDER_DEDUCTION"] },
          errorMessage: orderSn,
          status: "COMPLETED",
        },
      });

      if (!deductionJob) {
        return {
          success: true,
          skipped: true,
          message: `Pesanan #${orderSn} belum pernah dipotong stoknya. Restock dilewati.`,
          restocks: [],
        };
      }

      // B. Cek apakah pesanan ini sudah pernah di-restock
      const alreadyRestocked = await this.db.syncJob.findFirst({
        where: {
          integrationId: integration.id,
          type: { in: ["ORDER_CANCELLED", "ORDER_RESTOCK"] },
          errorMessage: orderSn,
          status: "COMPLETED",
        },
      });

      if (alreadyRestocked) {
        return {
          success: true,
          skipped: true,
          message: `Pesanan #${orderSn} sudah pernah di-restock sebelumnya. Restock dilewati.`,
          restocks: [],
        };
      }

      // 3. Kumpulkan rincian item pesanan
      let itemsToRestock = params.items || [];

      // Jika webhook payload tidak menyertakan daftar item, fetch melalui Open API Shopee
      if (itemsToRestock.length === 0) {
        try {
          const shopeeClient = await getShopeeClientForIntegration(integration.id);
          const detailRes = await shopeeClient.order.getOrderDetail({
            order_sn_list: [orderSn],
            response_optional_fields: "item_list",
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detailData = (detailRes as any)?.response || detailRes;
          const orderDetail = detailData?.order_list?.[0];
          const itemList =
            orderDetail?.item_list ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orderDetail?.package_list?.flatMap((pkg: any) => pkg.item_list || []) ||
            [];

          itemsToRestock = itemList.map(
            (it: {
              item_id?: number;
              model_id?: number;
              model_sku?: string;
              item_sku?: string;
              model_quantity_purchased?: number;
              model_quantity?: number;
              quantity?: number;
            }) => ({
              itemId: it.item_id,
              modelId: it.model_id,
              sku: (it.model_sku || it.item_sku || "").trim(),
              quantity:
                it.model_quantity_purchased ||
                it.model_quantity ||
                it.quantity ||
                1,
            })
          );
        } catch (err) {
          console.warn(`Gagal fetch order detail untuk #${orderSn}:`, err);
        }
      }

      // Fallback: Jika pemanggilan Open API Shopee gagal/kosong, ambil snapshot item dari pencatatan pemotongan pesanan
      if (itemsToRestock.length === 0) {
        try {
          const backupJob = await this.db.syncJob.findFirst({
            where: {
              integrationId: integration.id,
              type: "ORDER_DEDUCTION_ITEMS",
              errorMessage: { startsWith: `${orderSn}::` },
              status: "COMPLETED",
            },
            orderBy: { createdAt: "desc" },
          });

          if (backupJob?.errorMessage) {
            const jsonPart = backupJob.errorMessage.slice(orderSn.length + 2);
            itemsToRestock = JSON.parse(jsonPart);
          }
        } catch (backupErr) {
          console.warn(`Gagal mengambil backup item untuk pesanan #${orderSn}:`, backupErr);
        }
      }

      if (itemsToRestock.length === 0) {
        return {
          success: false,
          message: `Tidak ditemukan rincian item untuk pesanan #${orderSn}`,
          restocks: [],
        };
      }

      // 4. Tambah kembali stok produk di gudang secara transaksional ($transaction)
      const restockLogs: string[] = [];
      const restockedVariants: SyncStockItem[] = [];

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
        for (const item of itemsToRestock) {
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
            const modelIdStr =
              item.modelId !== undefined && item.modelId !== null
                ? String(item.modelId)
                : "";
            const pi = await tx.productIntegration.findFirst({
              where: {
                integrationId: integration.id,
                externalId: String(item.itemId),
                ...(modelIdStr && modelIdStr !== "0"
                  ? { externalModelId: modelIdStr }
                  : {
                      OR: [
                        { externalModelId: null },
                        { externalModelId: "" },
                        { externalModelId: "0" },
                      ],
                    }),
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
            restockLogs.push(
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
          const newStock = currentQty + orderQty;

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

          restockedVariants.push({
            variantId: variant.id,
            sku: variant.sku,
            quantity: orderQty,
          });
          restockLogs.push(
            `Stok SKU "${variant.sku}" (${variant.product?.name || "Produk"}) di gudang "${warehouseName}" bertambah ${orderQty} (${currentQty} -> ${updatedStock.stock}) karena pembatalan pesanan #${orderSn}`
          );
        }

        // Catat log restock pesanan untuk idempotency dalam transaksi yang sama
        await tx.syncJob.create({
          data: {
            integrationId: integration.id,
            type: "ORDER_CANCELLED",
            status: "COMPLETED",
            totalItems: itemsToRestock.length,
            processedItems: restockedVariants.length,
            errorMessage: orderSn,
          },
        });
      });

      // 5. Multi-Shop Sync: Sinkronkan sisa stok yang bertambah ke SEMUA toko Shopee aktif yang terhubung dengan gudang ini
      // KECUALI toko asal pesanan (integration.id), karena sistem marketplace Shopee sudah otomatis merestock listingnya sendiri
      let syncedStoresCount = 0;
      if (restockedVariants.length > 0) {
        const syncResult = await this.pushStockUpdateToShopee(
          warehouseId,
          restockedVariants,
          {
            allowInactive: false,
            excludeIntegrationId: integration.id,
            mode: "DELTA",
            deltaType: "INCREMENT",
          }
        );
        syncedStoresCount = syncResult.pushedCount;
      }

      return {
        success: true,
        message: `Berhasil merestock pesanan #${orderSn}. ${restockedVariants.length} varian dikembalikan ke gudang "${warehouseName}" dan stok telah disinkronkan ke toko Shopee.`,
        restocks: restockLogs,
        syncedStoresCount,
      };
    } catch (err) {
      console.error("Error pada processCancelledOrder:", err);
      return {
        success: false,
        message: err instanceof Error ? err.message : "Internal error",
        restocks: [],
      };
    }
  }

  /**
   * Alias untuk processCancelledOrder
   */
  async processOrderRestock(params: {
    shopId: string;
    orderSn: string;
    items?: Array<{
      itemId?: string | number;
      modelId?: string | number;
      sku?: string;
      quantity?: number;
    }>;
  }) {
    return this.processCancelledOrder(params);
  }
}

export const shopeeSyncService = new ShopeeSyncService();
