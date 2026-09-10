import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShopeeSyncService } from "../shopee-sync.service";

vi.mock("@/lib/shopee/client", () => ({
  getShopeeClientForIntegration: vi.fn().mockResolvedValue({
    product: {
      updateStock: vi.fn().mockResolvedValue({
        response: {
          success_list: [{ model_id: 0, stock: 10 }],
          failure_list: [],
        },
      }),
    },
  }),
}));

describe("ShopeeSyncService Unit Tests", () => {
  let shopeeSyncService: ShopeeSyncService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      integration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      productIntegration: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findFirst: vi.fn(),
      },
      productVariantStock: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      syncJob: {
        findFirst: vi.fn(),
        create: vi.fn(),
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
    expect(mockPrisma.integration.findMany).not.toHaveBeenCalled();
  });

  it("should skip pushing stock if warehouse is not mapped to an ACTIVE Shopee store", async () => {
    mockPrisma.integration.findMany.mockResolvedValue([]);

    const result = await shopeeSyncService.pushStockUpdateToShopee("wh-unmapped", [
      { variantId: "var-1", quantity: 2 },
    ]);

    expect(mockPrisma.integration.findMany).toHaveBeenCalledWith({
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
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        id: "int-1",
        warehouseId: "wh-1",
        shopId: "123456",
        platform: "SHOPEE",
        status: "ACTIVE",
      },
    ]);

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

  it("should push stock to multiple active stores sharing the same warehouse", async () => {
    mockPrisma.integration.findMany.mockResolvedValue([
      {
        id: "int-1",
        warehouseId: "wh-1",
        shopId: "shop-A",
        platform: "SHOPEE",
        status: "ACTIVE",
      },
      {
        id: "int-2",
        warehouseId: "wh-1",
        shopId: "shop-B",
        platform: "SHOPEE",
        status: "ACTIVE",
      },
    ]);

    mockPrisma.productIntegration.findMany
      .mockResolvedValueOnce([
        {
          id: "pi-1",
          integrationId: "int-1",
          variantId: "var-1",
          externalId: "1001",
          externalModelId: null,
          sku: "SKU-001",
          variant: { warehouseStocks: [{ stock: 20 }] },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "pi-2",
          integrationId: "int-2",
          variantId: "var-1",
          externalId: "2001",
          externalModelId: null,
          sku: "SKU-001",
          variant: { warehouseStocks: [{ stock: 20 }] },
        },
      ]);

    mockPrisma.productIntegration.update.mockResolvedValue({});

    const result = await shopeeSyncService.pushStockUpdateToShopee("wh-1", [
      { variantId: "var-1", quantity: 1 },
    ]);

    expect(result.success).toBe(true);
    expect(result.pushedCount).toBe(2);
    expect(mockPrisma.productIntegration.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.productIntegration.update).toHaveBeenCalledTimes(2);
  });

  describe("processShippedOrder", () => {
    it("should return early if orderSn was already processed (idempotent)", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-1",
        shopId: "shop-123",
        warehouseId: "wh-1",
        warehouse: { name: "Gudang Utama" },
      });

      mockPrisma.syncJob.findFirst.mockResolvedValue({
        id: "job-1",
        type: "ORDER_SHIPPED",
        errorMessage: "ORDER-SN-999",
        status: "COMPLETED",
      });

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-123",
        orderSn: "ORDER-SN-999",
      });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(mockPrisma.productVariantStock.upsert).not.toHaveBeenCalled();
    });

    it("should deduct warehouse stock according to sku & qty and sync to connected stores", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-1",
        shopId: "shop-123",
        warehouseId: "wh-1",
        warehouse: { name: "Gudang Utama" },
      });

      mockPrisma.syncJob.findFirst.mockResolvedValue(null);
      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-1",
        sku: "GAC-001-STD",
        product: { name: "test produk" },
      });

      // Stock awal di gudang adalah 20
      mockPrisma.productVariantStock.findUnique.mockResolvedValue({
        stock: 20,
      });

      // Stock baru di gudang setelah berkurang 2 adalah 18
      mockPrisma.productVariantStock.upsert.mockResolvedValue({
        stock: 18,
      });

      // Mock untuk pushStockUpdateToShopee
      mockPrisma.integration.findMany.mockResolvedValue([
        {
          id: "int-1",
          shopId: "shop-123",
          warehouseId: "wh-1",
          status: "ACTIVE",
        },
      ]);
      mockPrisma.productIntegration.findMany.mockResolvedValue([
        {
          id: "pi-1",
          externalId: "802008111",
          externalModelId: "10006268070",
          sku: "GAC-001-STD",
          variant: {
            warehouseStocks: [{ stock: 18 }],
          },
        },
      ]);
      mockPrisma.productIntegration.update.mockResolvedValue({});

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-123",
        orderSn: "ORDER-SN-12345",
        items: [
          {
            sku: "GAC-001-STD",
            quantity: 2,
          },
        ],
      });

      expect(res.success).toBe(true);
      // Memverifikasi stok dipotong di database (20 - 2 = 18)
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            variantId_warehouseId: {
              variantId: "var-1",
              warehouseId: "wh-1",
            },
          },
          update: { stock: 18 },
        })
      );
      // Memverifikasi dicatat ke syncJob untuk mencegah potongan ganda
      expect(mockPrisma.syncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            integrationId: "int-1",
            type: "ORDER_SHIPPED",
            errorMessage: "ORDER-SN-12345",
          }),
        })
      );
      // Memverifikasi sisa stok terdorong ke toko Shopee
      expect(res.syncedStoresCount).toBe(1);
    });
  });
});
