import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { integrationId, offset = 0, pageSize = 20, jobId } = body;

    if (!integrationId) {
      return NextResponse.json({ error: "integrationId wajib diisi" }, { status: 400 });
    }

    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
      include: { warehouse: true },
    });

    if (!integration) {
      return NextResponse.json({ error: "Integrasi tidak ditemukan" }, { status: 404 });
    }

    // 1. Kelola SyncJob di DB
    let currentJobId = jobId;
    if (!currentJobId) {
      const newJob = await prisma.syncJob.create({
        data: {
          integrationId,
          type: "PULL_PRODUCTS",
          status: "PROCESSING",
          totalItems: 0,
          processedItems: 0,
        },
      });
      currentJobId = newJob.id;
    }

    let itemsToProcess: Array<{
      itemId: string;
      modelId?: string;
      name: string;
      sku: string;
      stock: number;
      price: number;
    }> = [];
    let hasMore = false;
    let nextOffset = offset + pageSize;
    let totalItems = 0;

    let shopeeClient: Awaited<ReturnType<typeof getShopeeClientForIntegration>> | null = null;

    try {
      shopeeClient = await getShopeeClientForIntegration(integrationId);
      const shopee = shopeeClient;
      // Panggil API Shopee
      const listRes = await shopee.product.getItemList({
        offset: Number(offset),
        page_size: Number(pageSize),
        item_status: "NORMAL",
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const responseData = (listRes as any)?.response || listRes;
      const itemList = responseData?.item || responseData?.item_list || [];
      hasMore = responseData?.has_next_page ?? false;
      nextOffset = responseData?.next_offset ?? Number(offset) + itemList.length;
      totalItems = responseData?.total_count ?? (Number(offset) + itemList.length);

      if (itemList.length > 0) {
        // Ambil detail base info untuk mendapatkan nama & SKU
        const itemIds = itemList.map((i: { item_id: number }) => i.item_id);
        const infoRes = await shopee.product.getItemBaseInfo({
          item_id_list: itemIds,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const infoData = (infoRes as any)?.response || infoRes;
        const itemDetailList = infoData?.item_list || infoData?.item || [];

        for (const item of itemDetailList) {
          if (item.has_model) {
            // Ambil variasi model
            try {
              const modelRes = await shopee.product.getModelList({ item_id: item.item_id });
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const modelData = (modelRes as any)?.response || modelRes;
              const models = modelData?.model || [];
              for (const m of models) {
                const rawSku = (m.model_sku || item.item_sku || "").trim();
                itemsToProcess.push({
                  itemId: String(item.item_id),
                  modelId: String(m.model_id),
                  name: `${item.item_name} - ${m.model_name}`,
                  sku: rawSku || `SHOPEE-${item.item_id}-${m.model_id}`,
                  stock: m.stock_info_v2?.summary_info?.total_available_stock ?? 0,
                  price: m.price_info?.[0]?.current_price ?? 0,
                });
              }
            } catch {
              const rawSku = (item.item_sku || "").trim();
              itemsToProcess.push({
                itemId: String(item.item_id),
                name: item.item_name,
                sku: rawSku || `SHOPEE-${item.item_id}`,
                stock: 0,
                price: 0,
              });
            }
          } else {
            const rawSku = (item.item_sku || "").trim();
            itemsToProcess.push({
              itemId: String(item.item_id),
              name: item.item_name,
              sku: rawSku || `SHOPEE-${item.item_id}`,
              stock: item.stock_info_v2?.summary_info?.total_available_stock ?? 0,
              price: item.price_info?.[0]?.current_price ?? 0,
            });
          }
        }
      }
    } catch (apiError) {
      console.error("Shopee API call error:", apiError);
      // Fallback simulasi jika offline / sandbox credentials belum aktif
      if (process.env.SHOPEE_USE_MOCK === "true") {
        const simulatedTotal = 30;
        totalItems = simulatedTotal;
        const currentSimulated = Math.min(pageSize, Math.max(0, simulatedTotal - offset));
        for (let i = 0; i < currentSimulated; i++) {
          const itemIndex = offset + i + 1;
          itemsToProcess.push({
            itemId: `mock_item_${itemIndex}`,
            name: `Sample Shopee Product #${itemIndex}`,
            sku: `SKU-SP-${1000 + itemIndex}`,
            stock: 50,
            price: 150000,
          });
        }
        hasMore = offset + currentSimulated < simulatedTotal;
        nextOffset = offset + currentSimulated;
      } else {
        const msg = apiError instanceof Error ? apiError.message : String(apiError);
        
        // Cek apakah error terkait token / refresh token yang kedaluwarsa
        const isAuthError =
          msg.includes("error_shop_refresh_token") ||
          msg.includes("invalid_access_token") ||
          msg.includes("invalid_refresh_token") ||
          msg.includes("error_auth") ||
          msg.includes("No access token found") ||
          msg.includes("No token found to refresh") ||
          (msg.includes("403") && msg.includes("refresh_token"));

        if (currentJobId) {
          await prisma.syncJob.update({
            where: { id: currentJobId },
            data: {
              status: "FAILED",
              errorMessage: isAuthError
                ? "Sesi otorisasi Shopee telah kedaluwarsa (error_shop_refresh_token). Silakan lakukan otorisasi ulang toko."
                : msg,
            },
          });
        }

        if (isAuthError) {
          // Tandai integrasi agar admin tahu perlu re-auth
          await prisma.integration.update({
            where: { id: integrationId },
            data: { status: "INACTIVE" },
          });

          return NextResponse.json(
            {
              error: "Sesi otorisasi Shopee telah kedaluwarsa atau token tidak valid (error_shop_refresh_token). Silakan lakukan Otorisasi Ulang toko Shopee di menu Integrasi.",
              authExpired: true,
              details: msg,
            },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: `Gagal menarik produk dari Shopee: ${msg}` },
          { status: 502 }
        );
      }
    }

    // 2. Pencocokan ke Database Lokal berdasarkan SKU
    const processedResults = [];

    for (const item of itemsToProcess) {
      // Cari varian lokal berdasarkan SKU (case-insensitive & trimmed)
      const matchedVariant = await prisma.productVariant.findFirst({
        where: {
          sku: {
            equals: item.sku.trim(),
            mode: "insensitive",
          },
        },
        include: { product: true },
      });

      // Upsert ProductIntegration record
      const linked = await prisma.productIntegration.upsert({
        where: {
          integrationId_externalId_externalModelId: {
            integrationId,
            externalId: item.itemId,
            externalModelId: item.modelId || "",
          },
        },
        update: {
          sku: item.sku,
          productId: matchedVariant?.productId || null,
          variantId: matchedVariant?.id || null,
          syncStatus: matchedVariant ? "SYNCED" : "UNLINKED",
          lastSync: new Date(),
        },
        create: {
          integrationId,
          externalId: item.itemId,
          externalModelId: item.modelId || "",
          sku: item.sku,
          productId: matchedVariant?.productId || null,
          variantId: matchedVariant?.id || null,
          syncStatus: matchedVariant ? "SYNCED" : "UNLINKED",
        },
      });

      // Jika varian cocok dan toko memiliki pemetaan gudang, lakukan penyesuaian stok langsung ke Shopee
      let stockAdjusted = false;
      let warehouseStock: number | null = null;

      if (matchedVariant && integration.warehouseId) {
        const stockRecord = await prisma.productVariantStock.findUnique({
          where: {
            variantId_warehouseId: {
              variantId: matchedVariant.id,
              warehouseId: integration.warehouseId,
            },
          },
        });
        warehouseStock = stockRecord ? Math.max(0, stockRecord.stock) : 0;
        const itemId = parseInt(item.itemId, 10);
        const modelId = item.modelId ? parseInt(item.modelId, 10) : undefined;

        if (!isNaN(itemId) && shopeeClient) {
          try {
            await shopeeClient.product.updateStock({
              item_id: itemId,
              stock_list: [
                {
                  model_id: modelId || 0,
                  seller_stock: [
                    {
                      stock: warehouseStock,
                    },
                  ],
                },
              ],
            });
            stockAdjusted = true;
          } catch (stockErr) {
            console.warn(
              `Gagal sesuaikan stok Shopee untuk item ${itemId} model ${modelId}:`,
              stockErr
            );
          }
        }
      }

      processedResults.push({
        sku: item.sku,
        name: item.name,
        isLinked: !!matchedVariant,
        localProductName: matchedVariant?.product?.name || null,
        syncStatus: linked.syncStatus,
        stockAdjusted,
        warehouseStock,
      });
    }

    // 3. Update status SyncJob
    const updatedJob = await prisma.syncJob.update({
      where: { id: currentJobId },
      data: {
        totalItems: totalItems || undefined,
        processedItems: {
          increment: processedResults.length,
        },
        status: hasMore ? "PROCESSING" : "COMPLETED",
      },
    });

    return NextResponse.json({
      jobId: updatedJob.id,
      offset,
      nextOffset,
      hasMore,
      totalItems,
      batchCount: processedResults.length,
      processedTotal: updatedJob.processedItems,
      results: processedResults,
    });
  } catch (error) {
    console.error("Error pada sync products Shopee:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
