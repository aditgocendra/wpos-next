import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";
import { shopeeSyncService } from "@/services/shopee-sync.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "WAREHOUSE_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { orderSn, shopId, integrationId } = body;

    // 1. Kasus A: Sync pesanan spesifik berdasarkan orderSn
    if (orderSn) {
      const integration = integrationId
        ? await prisma.integration.findUnique({ where: { id: integrationId }, include: { warehouse: true } })
        : shopId
        ? await prisma.integration.findFirst({ where: { shopId: String(shopId) }, include: { warehouse: true } })
        : await prisma.integration.findFirst({ where: { warehouseId: { not: null } }, include: { warehouse: true } });

      if (!integration || !integration.shopId) {
        return NextResponse.json(
          { error: "Toko Shopee yang terhubung ke gudang tidak ditemukan." },
          { status: 404 }
        );
      }

      const result = await shopeeSyncService.processShippedOrder({
        shopId: integration.shopId,
        orderSn,
      });

      return NextResponse.json(result);
    }

    // 2. Kasus B: Tarik pesanan berstatus SHIPPED terkini dari toko Shopee aktif
    const integrations = await prisma.integration.findMany({
      where: {
        platform: "SHOPEE",
        warehouseId: { not: null },
        ...(integrationId ? { id: integrationId } : {}),
        ...(shopId ? { shopId: String(shopId) } : {}),
      },
      include: {
        warehouse: true,
      },
    });

    if (integrations.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada toko Shopee yang telah terhubung ke gudang." },
        { status: 404 }
      );
    }

    const allProcessedOrders = [];
    const allDeductionLogs: string[] = [];

    for (const item of integrations) {
      if (!item.shopId) continue;

      try {
        const shopeeClient = await getShopeeClientForIntegration(item.id);
        const fifteenDaysAgo = Math.floor(Date.now() / 1000) - 14 * 86400;
        const nowSeconds = Math.floor(Date.now() / 1000);

        // Tarik daftar pesanan SHIPPED dari Shopee
        const orderListRes = await shopeeClient.order.getOrderList({
          time_range_field: "update_time",
          time_from: fifteenDaysAgo,
          time_to: nowSeconds,
          page_size: 20,
          order_status: "SHIPPED",
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resData = (orderListRes as any)?.response || orderListRes;
        const orderList = resData?.order_list || [];

        for (const ord of orderList) {
          const sn = ord.order_sn;
          if (!sn) continue;

          const res = await shopeeSyncService.processShippedOrder({
            shopId: item.shopId,
            orderSn: sn,
          });

          if (res.success && !res.skipped) {
            allProcessedOrders.push(sn);
            allDeductionLogs.push(...res.deductions);
          }
        }
      } catch (err) {
        console.warn(`Gagal menarik pesanan SHIPPED untuk toko ${item.shopId}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      processedOrdersCount: allProcessedOrders.length,
      processedOrders: allProcessedOrders,
      deductions: allDeductionLogs,
      message:
        allProcessedOrders.length > 0
          ? `Berhasil memproses ${allProcessedOrders.length} pesanan terkirim. Stok gudang dan stok Shopee telah diperbarui.`
          : "Tidak ada pesanan berstatus SHIPPED baru yang memerlukan pemotongan stok.",
    });
  } catch (error) {
    console.error("Error pada sync orders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
