import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyShopeeWebhookSignature,
  getShopeeClientForIntegration,
} from "@/lib/shopee/client";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("authorization") || "";
    const url = req.nextUrl.toString();

    // 1. Verifikasi Signature Shopee
    const isValid = verifyShopeeWebhookSignature(url, rawBody, signature);
    if (!isValid) {
      console.warn("Shopee webhook signature tidak valid");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = {};

    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Ekstraksi data pesanan dari payload
    const orderData = payload.data || payload;
    const orderSn = orderData.ordersn || payload.ordersn;
    const orderStatus = (orderData.status || orderData.order_status || payload.status || "").toUpperCase();
    const shopIdNum = orderData.shop_id || payload.shop_id;

    if (!orderSn || !shopIdNum) {
      // Return success to acknowledge non-order push events
      return NextResponse.json({ code: 0, message: "Acknowledged (No orderSN or shopId)" });
    }

    // 2. ATURAN BISNIS KRUSIAL:
    // HANYA potong stok saat status pesanan adalah 'SHIPPED' (telah diserahkan ke kurir/jasa pengiriman).
    // Status lain (UNPAID, READY_TO_SHIP, PROCESSED, COMPLETED, CANCELLED) diabaikan untuk mutasi stok ini.
    if (orderStatus !== "SHIPPED") {
      return NextResponse.json({
        code: 0,
        message: `Status '${orderStatus}' diabaikan. Pemotongan stok hanya dilakukan saat status 'SHIPPED'.`,
      });
    }

    // 3. Cari Integrasi aktif berdasarkan shopId
    const integration = await prisma.integration.findFirst({
      where: {
        shopId: String(shopIdNum),
        status: "ACTIVE",
      },
      include: {
        warehouse: true,
      },
    });

    if (!integration || !integration.warehouseId || !integration.warehouse) {
      return NextResponse.json({
        code: 0,
        message: `Toko Shopee shopId ${shopIdNum} belum terhubung ke gudang atau tidak aktif.`,
      });
    }

    const warehouseId = integration.warehouseId;
    const warehouseName = integration.warehouse.name;
    let itemsToDeduct: Array<{ sku: string; quantity: number }> = [];

    // 4. Ambil rincian item pesanan
    if (orderData.items && Array.isArray(orderData.items) && orderData.items.length > 0) {
      itemsToDeduct = orderData.items
        .filter((it: { model_sku?: string; item_sku?: string }) => it.model_sku || it.item_sku)
        .map((it: { model_sku?: string; item_sku?: string; model_quantity_purchased?: number }) => ({
          sku: (it.model_sku || it.item_sku)!.trim(),
          quantity: it.model_quantity_purchased || 1,
        }));
    } else {
      // Jika payload webhook tidak menyertakan rincian item, tarik detail pesanan via SDK Shopee
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

        itemsToDeduct = itemList.map((it: { model_sku?: string; item_sku?: string; model_quantity_purchased?: number }) => ({
          sku: (it.model_sku || it.item_sku || "").trim(),
          quantity: it.model_quantity_purchased || 1,
        }));
      } catch (err) {
        console.warn(`Gagal fetch getOrderDetail untuk Shopee Order #${orderSn}:`, err);
      }
    }

    // 5. Potong stok produk di gudang yang terhubung berdasarkan SKU
    const deductionLogs: string[] = [];

    for (const item of itemsToDeduct) {
      if (!item.sku) continue;

      const variant = await prisma.productVariant.findFirst({
        where: { sku: item.sku },
        include: { product: true },
      });

      if (!variant) {
        deductionLogs.push(`SKU ${item.sku} tidak ditemukan di database POS lokal`);
        continue;
      }

      // Decrement stok di ProductVariantStock pada warehouseId terkait
      const updatedStock = await prisma.productVariantStock.upsert({
        where: {
          variantId_warehouseId: {
            variantId: variant.id,
            warehouseId,
          },
        },
        update: {
          stock: {
            decrement: item.quantity,
          },
        },
        create: {
          variantId: variant.id,
          warehouseId,
          stock: -item.quantity,
        },
      });

      deductionLogs.push(
        `Stok SKU ${item.sku} di gudang ${warehouseName} dipotong ${item.quantity} (Sisa: ${updatedStock.stock}) untuk Shopee Order #${orderSn}`
      );
    }

    console.log(`[Shopee Webhook SHIPPED] Order #${orderSn}:`, deductionLogs);

    // Selalu respon 200 OK ke Shopee
    return NextResponse.json({
      code: 0,
      message: "success",
      orderSn,
      deductions: deductionLogs,
    });
  } catch (error) {
    console.error("Error pada webhook Shopee orders:", error);
    // Shopee tetap mengharapkan response 200 jika payload diterima agar tidak spam retry
    return NextResponse.json({ code: 0, message: "Handled with error" });
  }
}
