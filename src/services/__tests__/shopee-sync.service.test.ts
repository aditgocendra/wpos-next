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
    order: {
      getOrderDetail: vi.fn().mockResolvedValue({
        response: {
          order_list: [
            {
              item_list: [
                {
                  item_id: 9999,
                  model_id: 8888,
                  model_sku: "FETCHED-SKU",
                  model_quantity_purchased: 3,
                },
              ],
            },
          ],
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
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(mockPrisma)),
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

    it("should return failure if store is not mapped to a warehouse", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-unmapped",
        shopId: "shop-unmapped",
        warehouseId: null,
        warehouse: null,
      });

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-unmapped",
        orderSn: "ORDER-SN-111",
      });

      expect(res.success).toBe(false);
      expect(res.message).toContain("belum dipetakan ke gudang");
    });

    it("should deduct warehouse stock in a transaction and sync to multiple stores (Toko A & Toko B)", async () => {
      // Toko A menerima order
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      mockPrisma.syncJob.findFirst.mockResolvedValue(null);
      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-1",
        sku: "PROD-SKU-01",
        product: { name: "Kemeja Flanel" },
      });

      // Stock awal di Gudang A adalah 50
      mockPrisma.productVariantStock.findUnique.mockResolvedValue({
        stock: 50,
      });

      // Stock baru di Gudang A setelah berkurang 5 adalah 45
      mockPrisma.productVariantStock.upsert.mockResolvedValue({
        stock: 45,
      });

      // Gudang A terhubung dengan Toko A dan Toko B
      mockPrisma.integration.findMany.mockResolvedValue([
        {
          id: "int-shop-a",
          shopId: "shop-A",
          warehouseId: "wh-gudang-a",
          status: "ACTIVE",
        },
        {
          id: "int-shop-b",
          shopId: "shop-B",
          warehouseId: "wh-gudang-a",
          status: "ACTIVE",
        },
      ]);

      mockPrisma.productIntegration.findMany
        .mockResolvedValueOnce([
          {
            id: "pi-a",
            integrationId: "int-shop-a",
            externalId: "11111",
            externalModelId: "0",
            sku: "PROD-SKU-01",
            variant: { warehouseStocks: [{ stock: 45 }] },
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "pi-b",
            integrationId: "int-shop-b",
            externalId: "22222",
            externalModelId: "0",
            sku: "PROD-SKU-01",
            variant: { warehouseStocks: [{ stock: 45 }] },
          },
        ]);

      mockPrisma.productIntegration.update.mockResolvedValue({});

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-A",
        orderSn: "ORDER-SHIPPED-001",
        items: [
          {
            sku: "PROD-SKU-01",
            quantity: 5,
          },
        ],
      });

      expect(res.success).toBe(true);
      // Memastikan $transaction dijalankan
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Memverifikasi stok dipotong di database (50 - 5 = 45)
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            variantId_warehouseId: {
              variantId: "var-1",
              warehouseId: "wh-gudang-a",
            },
          },
          update: { stock: 45 },
        })
      );

      // Memverifikasi dicatat ke syncJob untuk mencegah potongan ganda
      expect(mockPrisma.syncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            integrationId: "int-shop-a",
            type: "ORDER_SHIPPED",
            errorMessage: "ORDER-SHIPPED-001",
          }),
        })
      );

      // Memverifikasi sisa stok terdorong ke kedua toko (Toko A dan Toko B)
      expect(res.syncedStoresCount).toBe(2);
    });

    it("should fetch item details using Shopee API if items array is not provided in webhook", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      mockPrisma.syncJob.findFirst.mockResolvedValue(null);
      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-fetched",
        sku: "FETCHED-SKU",
        product: { name: "Fetched Product" },
      });

      mockPrisma.productVariantStock.findUnique.mockResolvedValue({ stock: 10 });
      mockPrisma.productVariantStock.upsert.mockResolvedValue({ stock: 7 });

      mockPrisma.integration.findMany.mockResolvedValue([]);

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-A",
        orderSn: "ORDER-NO-ITEMS-IN-PAYLOAD",
      });

      expect(res.success).toBe(true);
      // 10 - 3 (from mock getOrderDetail) = 7
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { stock: 7 },
        })
      );
    });

    it("should skip unmapped SKU and not crash the deduction flow", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      mockPrisma.syncJob.findFirst.mockResolvedValue(null);
      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      // SKU tidak ditemukan
      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productIntegration.findFirst.mockResolvedValue(null);
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-A",
        orderSn: "ORDER-UNKNOWN-SKU",
        items: [{ sku: "UNKNOWN-SKU-99", quantity: 1 }],
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.productVariantStock.upsert).not.toHaveBeenCalled();
      expect(res.deductions[0]).toContain("tidak ditemukan pada database produk lokal");
    });
  });
});
