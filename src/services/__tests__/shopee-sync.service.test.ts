import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShopeeSyncService } from "../shopee-sync.service";

describe("ShopeeSyncService Unit Tests", () => {
  let shopeeSyncService: ShopeeSyncService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      integration: {
        findFirst: vi.fn(),
      },
      productIntegration: {
        findMany: vi.fn(),
        update: vi.fn(),
      },
    };

    shopeeSyncService = new ShopeeSyncService(mockPrisma);
  });

  it("should return early when warehouseId or items are missing", async () => {
    const res1 = await shopeeSyncService.pushStockUpdateToShopee("", []);
    expect(res1.success).toBe(true);
    expect(res1.pushedCount).toBe(0);

    const res2 = await shopeeSyncService.pushStockUpdateToShopee("wh-1", []);
    expect(res2.success).toBe(true);
    expect(res2.pushedCount).toBe(0);
    expect(mockPrisma.integration.findFirst).not.toHaveBeenCalled();
  });

  it("should skip pushing stock if warehouse is not mapped to an ACTIVE Shopee store", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue(null);

    const result = await shopeeSyncService.pushStockUpdateToShopee("wh-unmapped", [
      { variantId: "var-1", quantity: 2 },
    ]);

    expect(mockPrisma.integration.findFirst).toHaveBeenCalledWith({
      where: {
        warehouseId: "wh-unmapped",
        platform: "SHOPEE",
        status: "ACTIVE",
      },
    });
    expect(result.success).toBe(true);
    expect(result.pushedCount).toBe(0);
    expect(mockPrisma.productIntegration.findMany).not.toHaveBeenCalled();
  });

  it("should find mapped product integrations and push stock when store is ACTIVE", async () => {
    mockPrisma.integration.findFirst.mockResolvedValue({
      id: "int-1",
      warehouseId: "wh-1",
      shopId: "123456",
      platform: "SHOPEE",
      status: "ACTIVE",
    });

    mockPrisma.productIntegration.findMany.mockResolvedValue([
      {
        id: "pi-1",
        integrationId: "int-1",
        productId: "prod-1",
        variantId: "var-1",
        externalId: "98765",
        externalModelId: null,
        sku: "SKU-001",
        variant: {
          warehouseStocks: [{ stock: 45 }],
        },
      },
    ]);

    mockPrisma.productIntegration.update.mockResolvedValue({});

    const result = await shopeeSyncService.pushStockUpdateToShopee("wh-1", [
      { variantId: "var-1", quantity: 5 },
    ]);

    expect(result.success).toBe(true);
    expect(result.pushedCount).toBe(1);
    expect(mockPrisma.productIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pi-1" },
        data: expect.objectContaining({ lastSync: expect.any(Date) }),
      })
    );
  });
});
