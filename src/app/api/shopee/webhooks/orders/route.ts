import { NextRequest, NextResponse } from "next/server";
import { verifyShopeeWebhookSignature } from "@/lib/shopee/client";
import { shopeeSyncService } from "@/services/shopee-sync.service";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Shopee orders webhook endpoint is ready and active.",
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const url = req.nextUrl.toString();

    // 1. Verifikasi Signature Shopee (jika signature disertakan)
    if (signature) {
      const isValidDirect = verifyShopeeWebhookSignature(url, rawBody, signature);
      if (!isValidDirect) {
        // Coba validasi dengan URL proxy / tunnel (x-forwarded-*)
        const forwardedProto =
          req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
        const forwardedHost =
          req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
        const fullUrl = `${forwardedProto}://${forwardedHost}${req.nextUrl.pathname}${req.nextUrl.search}`;
        const isValidForwarded = verifyShopeeWebhookSignature(fullUrl, rawBody, signature);

        if (!isValidForwarded && process.env.NODE_ENV === "production") {
          console.warn("Shopee webhook signature tidak valid:", { url, fullUrl, signature });
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Ekstraksi parameter pesanan
    const orderData = payload.data || payload;
    const orderSn = String(orderData.ordersn || payload.ordersn || "").trim();
    const orderStatus = String(
      orderData.status || orderData.order_status || payload.status || ""
    ).toUpperCase();
    const logisticsStatus = String(
      orderData.logistics_status || payload.logistics_status || ""
    ).toUpperCase();
    const shopId = String(orderData.shop_id || payload.shop_id || "").trim();

    if (!orderSn || !shopId) {
      // Acknowledge non-order push events
      return NextResponse.json({
        code: 0,
        message: "Acknowledged (No orderSN or shopId)",
      });
    }

    // 2. Aturan Bisnis:
    // Potong stok saat pesanan sudah dipickup / diserahkan ke jasa pengiriman (status 'SHIPPED')
    const isHandedOver =
      orderStatus === "SHIPPED" ||
      logisticsStatus === "LOGISTICS_PICKUP_DONE" ||
      logisticsStatus === "LOGISTICS_SHIPPED" ||
      (orderStatus === "PROCESSED" && payload.code === 3);

    if (!isHandedOver) {
      return NextResponse.json({
        code: 0,
        message: `Status '${orderStatus || logisticsStatus}' diabaikan. Pemotongan stok hanya dilakukan saat pesanan diserahkan ke jasa pengiriman (SHIPPED).`,
        orderSn,
      });
    }

    // Ekstraksi items jika disertakan langsung pada payload
    let items = undefined;
    const rawItems = orderData.items || orderData.item_list;
    if (Array.isArray(rawItems) && rawItems.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items = rawItems.map((it: any) => ({
        itemId: it.item_id,
        modelId: it.model_id,
        sku: (it.model_sku || it.item_sku || "").trim(),
        quantity: it.model_quantity_purchased || it.model_quantity || it.quantity || 1,
      }));
    }

    // 3. Proses pemotongan stok gudang dan sinkronisasi ke seluruh toko Shopee terhubung
    const result = await shopeeSyncService.processShippedOrder({
      shopId,
      orderSn,
      items,
    });

    console.log(`[Shopee Webhook SHIPPED] Order #${orderSn}:`, result);

    return NextResponse.json({
      code: 0,
      message: result.message,
      orderSn,
      deductions: result.deductions,
      syncedStoresCount: result.syncedStoresCount,
    });
  } catch (error) {
    console.error("Error pada webhook Shopee orders:", error);
    return NextResponse.json({
      code: 0,
      message: error instanceof Error ? error.message : "Handled with error",
    });
  }
}
