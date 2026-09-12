import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { NextRequest } from "next/server";
import { shopeeSyncService } from "@/services/shopee-sync.service";
import { prisma } from "@/lib/prisma";

vi.mock("@/services/shopee-sync.service", () => ({
  shopeeSyncService: {
    processShippedOrder: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    integration: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/shopee/client", () => ({
  verifyShopeeWebhookSignature: vi.fn().mockReturnValue(true),
  getShopeeEnvConfig: vi.fn().mockReturnValue({
    partnerId: 12345,
    partnerKey: "secret-key",
  }),
}));

describe("Shopee Webhook Route Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should respond to GET request with healthcheck ok", async () => {
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("should handle empty body test ping gracefully", async () => {
    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: "",
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe(0);
    expect(data.message).toContain("acknowledged");
  });

  it("should handle test push event (code 0)", async () => {
    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: JSON.stringify({ code: 0, test: true }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe(0);
  });

  it("should process SHIPPED order and trigger shopeeSyncService.processShippedOrder", async () => {
    vi.mocked(shopeeSyncService.processShippedOrder).mockResolvedValue({
      success: true,
      message: "Stok berhasil dipotong dan disinkronkan",
      deductions: ["SKU-001 berkurang 2"],
      syncedStoresCount: 2,
    });

    const payload = {
      code: 3,
      shop_id: "shop-123",
      data: {
        ordersn: "230912ABC12345",
        status: "SHIPPED",
        items: [
          {
            item_id: 111,
            model_id: 222,
            model_sku: "SKU-001",
            model_quantity_purchased: 2,
          },
        ],
      },
    };

    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe(0);
    expect(shopeeSyncService.processShippedOrder).toHaveBeenCalledWith({
      shopId: "shop-123",
      orderSn: "230912ABC12345",
      items: [
        {
          itemId: 111,
          modelId: 222,
          sku: "SKU-001",
          quantity: 2,
        },
      ],
    });
  });

  it("should recognize LOGISTICS_PICKUP_DONE status as shipped and deduct stock", async () => {
    vi.mocked(shopeeSyncService.processShippedOrder).mockResolvedValue({
      success: true,
      message: "Berhasil",
      deductions: [],
      syncedStoresCount: 1,
    });

    const payload = {
      code: 3,
      shop_id: "shop-456",
      data: {
        ordersn: "PICKUP-DONE-999",
        status: "PROCESSED",
        logistics_status: "LOGISTICS_PICKUP_DONE",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe(0);
    expect(shopeeSyncService.processShippedOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "shop-456",
        orderSn: "PICKUP-DONE-999",
      })
    );
  });

  it("should acknowledge without stock change if order is not shipped", async () => {
    const payload = {
      code: 3,
      shop_id: "shop-123",
      data: {
        ordersn: "NOT-SHIPPED-YET",
        status: "READY_TO_SHIP",
        logistics_status: "LOGISTICS_NOT_START",
      },
    };

    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("without stock change");
    expect(shopeeSyncService.processShippedOrder).not.toHaveBeenCalled();
  });

  it("should update integration status on authorization event (code 1)", async () => {
    const req = new NextRequest("http://localhost:3000/api/shopee/webhook", {
      method: "POST",
      body: JSON.stringify({ code: 1, shop_id: "shop-999" }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.code).toBe(0);
    expect(prisma.integration.updateMany).toHaveBeenCalledWith({
      where: { shopId: "shop-999", platform: "SHOPEE" },
      data: { status: "ACTIVE", updatedAt: expect.any(Date) },
    });
  });
});
