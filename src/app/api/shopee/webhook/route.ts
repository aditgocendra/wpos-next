import { NextRequest, NextResponse } from "next/server";
import { verifyShopeeWebhookSignature } from "@/lib/shopee/client";
import { shopeeSyncService } from "@/services/shopee-sync.service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Shopee Webhook receiver endpoint is active and ready to receive push events.",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBodyBuffer = await req.arrayBuffer();
    const rawBody = Buffer.from(rawBodyBuffer).toString("utf-8");
    const signature = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const url = req.nextUrl.toString();

    // 1. Handle empty body (e.g. test push ping dari Shopee)
    if (!rawBody || !rawBody.trim()) {
      console.log("[Shopee Webhook] Received empty body (test ping acknowledged)");
      return NextResponse.json({ code: 0, message: "OK (Ping acknowledged)" });
    }

    // 2. Parse Payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn("[Shopee Webhook] Non-JSON payload received:", rawBody);
      // Selalu respon 200 agar test push / handshake Shopee tidak gagal
      return NextResponse.json({ code: 0, message: "Payload acknowledged" });
    }

    const eventCode = Number(payload.code);
    const shopId = String(payload.shop_id || payload.data?.shop_id || "").trim();
    const isTestPush = eventCode === 0 || payload.test || payload.msg === "test";

    // 3. Verifikasi Signature Shopee jika signature disertakan
    if (signature) {
      let isValid = verifyShopeeWebhookSignature(url, rawBody, signature);
      
      // Jika url bawaan gagal, coba variasi dengan trailing slash
      if (!isValid) isValid = verifyShopeeWebhookSignature(url + "/", rawBody, signature);

      if (!isValid) {
        // Cek dengan forwarded host jika di balik reverse proxy / Vercel
        const forwardedProto = req.headers.get("x-forwarded-proto") || req.nextUrl.protocol.replace(":", "");
        const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || req.nextUrl.host;
        const fullUrl = `${forwardedProto}://${forwardedHost}${req.nextUrl.pathname}${req.nextUrl.search}`;
        
        isValid = verifyShopeeWebhookSignature(fullUrl, rawBody, signature);
        if (!isValid) isValid = verifyShopeeWebhookSignature(fullUrl + "/", rawBody, signature);
        
        if (!isValid && process.env.NODE_ENV === "production") {
          console.warn("[Shopee Webhook] Signature tidak valid (DEBUG DETAIL):", { 
            url, 
            fullUrl, 
            signature,
            rawBody, // Tambahkan rawBody untuk melihat apakah ada perbedaan spasi/karakter
            partnerKeyLength: process.env.SHOPEE_PARTNER_KEY?.length
          });
          
          if (!isTestPush) {
            // Tolak request dengan 401 jika bukan test push
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
          }
          console.warn("[Shopee Webhook] Bypassing invalid signature because it is a test push.");
        }
      }
    }

    console.log(`[Shopee Webhook] Received Event Code ${eventCode} for shopId ${shopId || "N/A"}`);

    // 4. Test event code atau handshake ping
    if (isTestPush) {
      console.log("[Shopee Webhook] Test push event acknowledged:", payload);
      
      // Syarat mutlak Shopee: Jika payload mengandung verify_info, kita HARUS membalas dengan verify_info tersebut!
      if (payload.data && payload.data.verify_info) {
        return NextResponse.json({ verify_info: payload.data.verify_info });
      }
      
      return NextResponse.json({ code: 0, message: "Test push acknowledged successfully" });
    }

    // Handler berdasarkan event code Shopee:
    // Code 1: Shop authorization for partners
    if (eventCode === 1) {
      console.log(`[Shopee Webhook] Toko berhasil diotorisasi: Shop ID ${shopId}`);
      if (shopId) {
        await prisma.integration.updateMany({
          where: { shopId, platform: "SHOPEE" },
          data: { status: "ACTIVE", updatedAt: new Date() },
        });
      }
      return NextResponse.json({ code: 0, message: "Shop authorization acknowledged" });
    }

    // Code 2: Shop deauthorization for partners
    if (eventCode === 2) {
      console.warn(`[Shopee Webhook] Toko dicabut otorisasi (Deauthorized): Shop ID ${shopId}`);
      if (shopId) {
        await prisma.integration.updateMany({
          where: { shopId, platform: "SHOPEE" },
          data: { status: "INACTIVE", updatedAt: new Date() },
        });
      }
      return NextResponse.json({ code: 0, message: "Shop deauthorization acknowledged" });
    }

    // Code 12: OpenAPI authorization expiry push
    if (eventCode === 12) {
      console.warn(`[Shopee Webhook] Peringatan: Token otorisasi toko akan kadaluarsa: Shop ID ${shopId}`);
      return NextResponse.json({ code: 0, message: "Expiry warning acknowledged" });
    }

    // Code 3: Order status update push
    if (eventCode === 3 || payload.ordersn || payload.data?.ordersn) {
      const orderData = payload.data || payload;
      const orderSn = String(orderData.ordersn || payload.ordersn || "").trim();
      const orderStatus = String(
        orderData.status || orderData.order_status || payload.status || ""
      ).toUpperCase();
      const logisticsStatus = String(
        orderData.logistics_status || payload.logistics_status || ""
      ).toUpperCase();

      if (!orderSn || !shopId) {
        return NextResponse.json({
          code: 0,
          message: "Acknowledged (No orderSN or shopId)",
        });
      }

      // Aturan Bisnis: Pemotongan stok gudang dan sinkronisasi saat order SHIPPED
      const isHandedOver =
        orderStatus === "SHIPPED" ||
        logisticsStatus === "LOGISTICS_PICKUP_DONE" ||
        logisticsStatus === "LOGISTICS_DELIVERY_DONE" ||
        logisticsStatus === "LOGISTICS_SHIPPED" ||
        (orderStatus === "PROCESSED" && eventCode === 3);

      if (isHandedOver) {
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
        });
      }

      return NextResponse.json({
        code: 0,
        message: `Status '${orderStatus || logisticsStatus}' acknowledged without stock change.`,
        orderSn,
      });
    }

    // Default acknowledgement for any other event types
    return NextResponse.json({
      code: 0,
      message: `Event code ${eventCode || "unknown"} acknowledged`,
    });
  } catch (error) {
    console.error("[Shopee Webhook] Error processing push event:", error);
    // Selalu respon 200 dengan code 0 agar Shopee tidak memblokir/suspend push service
    return NextResponse.json({
      code: 0,
      message: error instanceof Error ? error.message : "Handled with error",
    });
  }
}
