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
      getItemBaseInfo: vi.fn().mockResolvedValue({
        response: {
          item_list: [
            {
              item_id: 11111,
              stock_info_v2: {
                summary_info: { total_available_stock: 100 },
                seller_stock: [{ stock: 100 }],
              },
            },
            {
              item_id: 22222,
              stock_info_v2: {
                summary_info: { total_available_stock: 70 },
                seller_stock: [{ stock: 70 }],
              },
            },
            {
              item_id: 98765,
              stock_info_v2: {
                summary_info: { total_available_stock: 45 },
                seller_stock: [{ stock: 45 }],
              },
            },
          ],
        },
      }),
      getModelList: vi.fn().mockResolvedValue({
        response: {
          model: [],
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

      // Gudang A terhubung dengan Toko A dan Toko B. Tapi Toko A di-exclude karena stoknya sudah dipotong oleh Shopee langsung
      mockPrisma.integration.findMany.mockImplementation(async (args: any) => {
        const notId = args?.where?.id?.not;
        const all = [
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
        ];
        return notId ? all.filter((i) => i.id !== notId) : all;
      });

      mockPrisma.productIntegration.findMany.mockResolvedValue([
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

      // Memverifikasi hanya toko lain (Toko B) yang disinkronkan, karena Toko A sudah dipotong Shopee otomatis
      expect(res.syncedStoresCount).toBe(1);
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

  describe("processCancelledOrder", () => {
    it("should skip restock if order was never deducted", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-1",
        shopId: "shop-123",
        warehouseId: "wh-1",
        warehouse: { name: "Gudang Utama" },
      });

      // Belum pernah ada catatan pemotongan stok
      mockPrisma.syncJob.findFirst.mockResolvedValue(null);

      const res = await shopeeSyncService.processCancelledOrder({
        shopId: "shop-123",
        orderSn: "CANCEL-ORDER-NOT-DEDUCTED",
      });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(res.message).toContain("belum pernah dipotong");
      expect(mockPrisma.productVariantStock.upsert).not.toHaveBeenCalled();
    });

    it("should skip restock if order was already restocked (idempotent)", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-1",
        shopId: "shop-123",
        warehouseId: "wh-1",
        warehouse: { name: "Gudang Utama" },
      });

      // 1. Cek potongan: pernah dipotong
      // 2. Cek restock: sudah pernah di-restock
      mockPrisma.syncJob.findFirst
        .mockResolvedValueOnce({
          id: "job-deduct-1",
          type: "ORDER_SHIPPED",
          errorMessage: "ORDER-ALREADY-RESTOCKED",
          status: "COMPLETED",
        })
        .mockResolvedValueOnce({
          id: "job-restock-1",
          type: "ORDER_CANCELLED",
          errorMessage: "ORDER-ALREADY-RESTOCKED",
          status: "COMPLETED",
        });

      const res = await shopeeSyncService.processCancelledOrder({
        shopId: "shop-123",
        orderSn: "ORDER-ALREADY-RESTOCKED",
      });

      expect(res.success).toBe(true);
      expect(res.skipped).toBe(true);
      expect(res.message).toContain("sudah pernah di-restock");
      expect(mockPrisma.productVariantStock.upsert).not.toHaveBeenCalled();
    });

    it("should restock warehouse stock and sync updated stock to multiple stores (Toko A & Toko B)", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      // Pernah dipotong, belum pernah di-restock
      mockPrisma.syncJob.findFirst
        .mockResolvedValueOnce({
          id: "job-deduct-1",
          type: "ORDER_SHIPPED",
          errorMessage: "ORDER-CANCELLED-001",
          status: "COMPLETED",
        })
        .mockResolvedValueOnce(null);

      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-restock-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-1",
        sku: "PROD-SKU-01",
        product: { name: "Kemeja Flanel" },
      });

      // Stock awal sebelum pembatalan adalah 45
      mockPrisma.productVariantStock.findUnique.mockResolvedValue({
        stock: 45,
      });

      // Stock baru di Gudang A setelah dibatalkan bertambah 5 menjadi 50
      mockPrisma.productVariantStock.upsert.mockResolvedValue({
        stock: 50,
      });

      // Gudang A terhubung dengan Toko A dan Toko B. Tapi Toko A harus di-exclude agar tidak double restock di Shopee!
      mockPrisma.integration.findMany.mockImplementation(async (args: any) => {
        const notId = args?.where?.id?.not;
        const all = [
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
        ];
        return notId ? all.filter((i) => i.id !== notId) : all;
      });

      mockPrisma.productIntegration.findMany.mockResolvedValue([
        {
          id: "pi-b",
          integrationId: "int-shop-b",
          externalId: "22222",
          externalModelId: "0",
          sku: "PROD-SKU-01",
          variant: { warehouseStocks: [{ stock: 50 }] },
        },
      ]);

      mockPrisma.productIntegration.update.mockResolvedValue({});

      const res = await shopeeSyncService.processCancelledOrder({
        shopId: "shop-A",
        orderSn: "ORDER-CANCELLED-001",
        items: [
          {
            sku: "PROD-SKU-01",
            quantity: 5,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();

      // Verifikasi stok ditambahkan di database (45 + 5 = 50)
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            variantId_warehouseId: {
              variantId: "var-1",
              warehouseId: "wh-gudang-a",
            },
          },
          update: { stock: 50 },
        })
      );

      // Verifikasi dicatat ke syncJob dengan type ORDER_CANCELLED
      expect(mockPrisma.syncJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            integrationId: "int-shop-a",
            type: "ORDER_CANCELLED",
            errorMessage: "ORDER-CANCELLED-001",
          }),
        })
      );

      // Verifikasi sisa stok terdorong HANYA ke Toko B (Toko A di-exclude dari API push untuk mencegah double restock 6)
      expect(res.syncedStoresCount).toBe(1);
    });

    it("should fetch item details using Shopee API if items array is omitted on cancel", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      mockPrisma.syncJob.findFirst
        .mockResolvedValueOnce({
          id: "job-deduct-1",
          type: "ORDER_SHIPPED",
          errorMessage: "ORDER-CANCEL-FETCH",
          status: "COMPLETED",
        })
        .mockResolvedValueOnce(null);

      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-fetched",
        sku: "FETCHED-SKU",
        product: { name: "Fetched Product" },
      });

      mockPrisma.productVariantStock.findUnique.mockResolvedValue({ stock: 10 });
      // 10 + 3 (dari mock getOrderDetail item_list quantity 3) = 13
      mockPrisma.productVariantStock.upsert.mockResolvedValue({ stock: 13 });
      mockPrisma.integration.findMany.mockResolvedValue([]);

      const res = await shopeeSyncService.processCancelledOrder({
        shopId: "shop-A",
        orderSn: "ORDER-CANCEL-FETCH",
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { stock: 13 },
        })
      );
    });

    it("should fallback to ORDER_DEDUCTION_ITEMS snapshot when items array is omitted and Shopee API getOrderDetail fails", async () => {
      mockPrisma.integration.findFirst.mockResolvedValue({
        id: "int-shop-a",
        shopId: "shop-A",
        warehouseId: "wh-gudang-a",
        warehouse: { name: "Gudang A" },
      });

      // Pengecekan 1: deductionJob (COMPLETED)
      // Pengecekan 2: alreadyRestocked (null)
      // Pengecekan 3 (fallback backup items): ORDER_DEDUCTION_ITEMS job
      mockPrisma.syncJob.findFirst
        .mockResolvedValueOnce({
          id: "job-deduct-1",
          type: "ORDER_SHIPPED",
          errorMessage: "ORDER-FALLBACK-001",
          status: "COMPLETED",
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "job-backup-1",
          type: "ORDER_DEDUCTION_ITEMS",
          errorMessage: `ORDER-FALLBACK-001::${JSON.stringify([{ sku: "BACKUP-SKU-1", quantity: 2 }])}`,
          status: "COMPLETED",
        });

      mockPrisma.syncJob.create.mockResolvedValue({ id: "job-new" });

      mockPrisma.productVariant.findFirst.mockResolvedValue({
        id: "var-backup",
        sku: "BACKUP-SKU-1",
        product: { name: "Backup Product" },
      });

      // Stock awal 4 di gudang, kembali 2 menjadi 6
      mockPrisma.productVariantStock.findUnique.mockResolvedValue({ stock: 4 });
      mockPrisma.productVariantStock.upsert.mockResolvedValue({ stock: 6 });
      mockPrisma.integration.findMany.mockResolvedValue([]);

      // Mock client order detail throws error
      const { getShopeeClientForIntegration } = await import("@/lib/shopee/client");
      vi.mocked(getShopeeClientForIntegration).mockResolvedValueOnce({
        order: {
          getOrderDetail: vi.fn().mockRejectedValue(new Error("Shopee API timeout")),
        },
      } as any);

      const res = await shopeeSyncService.processCancelledOrder({
        shopId: "shop-A",
        orderSn: "ORDER-FALLBACK-001",
      });

      expect(res.success).toBe(true);
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { stock: 6 },
        })
      );
    });

    it("should correctly handle user scenario: Toko A receives order Q=1, Gudang A reduced 50->49, Toko B reduced 70->69, Toko A not double-deducted", async () => {
      // Skenario User:
      // Stock Gudang A : 50
      // Stock Toko A (Terhubung Gudang A) : 100 di Shopee
      // Stock Toko B (Terhubung Gudang A) : 70 di Shopee
      // Pesanan masuk pada Toko A sebesar 1:
      // Hasil yang diharapkan:
      // Stock Gudang A : 49
      // Stock Toko A : 99 (Shopee sudah potong otomatis, jangan ditimpa atau dipotong ganda)
      // Stock Toko B : 69 (Dipotong 1 via Shopee API update_stock)

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
        sku: "SKU-SHARED-01",
        product: { name: "Produk Saling Terhubung" },
      });

      // Stock awal Gudang A = 50
      mockPrisma.productVariantStock.findUnique.mockResolvedValue({ stock: 50 });
      mockPrisma.productVariantStock.upsert.mockResolvedValue({ stock: 49 });

      // Integrasi toko yang terhubung ke Gudang A
      mockPrisma.integration.findMany.mockImplementation(async (args: any) => {
        const notId = args?.where?.id?.not;
        const all = [
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
        ];
        return notId ? all.filter((i) => i.id !== notId) : all;
      });

      // Mapping produk untuk Toko B
      mockPrisma.productIntegration.findMany.mockResolvedValue([
        {
          id: "pi-b",
          integrationId: "int-shop-b",
          externalId: "2001",
          externalModelId: "0",
          sku: "SKU-SHARED-01",
          variant: { warehouseStocks: [{ stock: 49 }] },
        },
      ]);

      mockPrisma.productIntegration.update.mockResolvedValue({});

      const mockUpdateStock = vi.fn().mockResolvedValue({
        response: { success_list: [{ model_id: 0, stock: 69 }], failure_list: [] },
      });

      const { getShopeeClientForIntegration } = await import("@/lib/shopee/client");
      vi.mocked(getShopeeClientForIntegration).mockResolvedValue({
        product: {
          updateStock: mockUpdateStock,
          getItemBaseInfo: vi.fn().mockResolvedValue({
            response: {
              item_list: [
                {
                  item_id: 2001,
                  stock_info_v2: {
                    summary_info: { total_available_stock: 70 },
                    seller_stock: [{ stock: 70 }],
                  },
                },
              ],
            },
          }),
          getModelList: vi.fn().mockResolvedValue({ response: { model: [] } }),
        },
      } as any);

      const res = await shopeeSyncService.processShippedOrder({
        shopId: "shop-A",
        orderSn: "ORDER-USER-001",
        items: [
          {
            sku: "SKU-SHARED-01",
            quantity: 1,
          },
        ],
      });

      expect(res.success).toBe(true);

      // 1. Gudang A berkurang dari 50 menjadi 49
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { stock: 49 },
        })
      );

      // 2. Toko B (Shop B) menerima update_stock dari 70 dikurangi 1 menjadi 69
      expect(mockUpdateStock).toHaveBeenCalledWith({
        item_id: 2001,
        stock_list: [
          {
            model_id: 0,
            seller_stock: [{ stock: 69 }],
          },
        ],
      });

      // 3. Toko A tidak dipotong dua kali (hanya 1 toko yang disinkronkan, yaitu Toko B)
      expect(res.syncedStoresCount).toBe(1);
    });
  });
});
