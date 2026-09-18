import { describe, it, expect, vi, beforeEach } from "vitest";
import { ShopeeOrderService } from "../shopee-order.service";

describe("ShopeeOrderService Unit Tests", () => {
  let service: ShopeeOrderService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      integration: {
        findUnique: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
      },
      shopeeMonthlyExpense: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const mockClientFactory = vi.fn().mockResolvedValue({
      order: {
        getOrderList: vi.fn().mockResolvedValue({ response: { order_list: [] } }),
        getOrderDetail: vi.fn().mockResolvedValue({ response: { order_list: [] } }),
      },
    });
    service = new ShopeeOrderService(mockPrisma, mockClientFactory as any);
  });

  describe("Validation and Shop Integration", () => {
    it("should throw error if integrationId is not provided", async () => {
      // @ts-expect-error test missing integrationId
      await expect(service.fetchLiveOrders({})).rejects.toThrow("integrationId wajib diisi.");
    });

    it("should throw error if integration is not found in database", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.fetchLiveOrders({ integrationId: "invalid-id", month: "2026-09" })
      ).rejects.toThrow("Integrasi Toko dengan ID invalid-id tidak ditemukan.");
    });
  });

  describe("HPP & Financial Calculations in Mock/Live Mode", () => {
    it("should accurately calculate Gross Income, HPP, and Net Profit Margin with monthly expenses", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue({
        id: "shop-1",
        shopId: "123456",
        status: "ACTIVE",
      });

      // Mock inventory variants with specific HPP (priceCost)
      mockPrisma.productVariant.findMany.mockResolvedValue([
        { sku: "SKU-001", priceCost: 40000, priceSell: 80000, variantName: "Merah", product: { name: "Baju" } },
        { sku: "SKU-002", priceCost: 50000, priceSell: 100000, variantName: "Biru", product: { name: "Celana" } },
      ]);

      // Mock existing monthly expenses (Iklan, Operasional, Minus Order)
      mockPrisma.shopeeMonthlyExpense.findFirst.mockResolvedValue({
        id: "exp-1",
        month: "2026-09",
        integrationId: "shop-1",
        adCost: 50000,
        operationalCost: 25000,
        unexpectedCost: 15000,
      });

      // Mock pullOrdersFromShopee directly for deterministic testing
      vi.spyOn(service as any, "pullOrdersFromShopee").mockResolvedValue([
        {
          orderSn: "ORD-COMPLETED-1",
          createTime: 1726000000,
          orderStatus: "COMPLETED",
          cancelReason: "",
          productName: "Baju Merah",
          sku: "SKU-001",
          quantity: 2,
          grossIncome: 160000, // 2 x 80000
        },
        {
          orderSn: "ORD-CANCELLED-2",
          createTime: 1726010000,
          orderStatus: "CANCELLED",
          cancelReason: "Pembeli berubah pikiran",
          productName: "Celana Biru",
          sku: "SKU-002",
          quantity: 1,
          grossIncome: 100000, // Should be converted to 0 because status is CANCELLED!
        },
      ]);

      const result = await service.fetchLiveOrders({
        integrationId: "shop-1",
        month: "2026-09",
        refresh: true,
      });

      // 1. Verify items calculations
      expect(result.items.length).toBe(2);

      const completedItem = result.items.find((it) => it.noPesanan === "ORD-COMPLETED-1");
      expect(completedItem).toBeDefined();
      expect(completedItem?.pendapatanKotor).toBe(160000);
      expect(completedItem?.hppPerUnit).toBe(40000);
      expect(completedItem?.hppTotal).toBe(80000); // 40000 * 2
      expect(completedItem?.pendapatanSebelumBiayaLainnya).toBe(80000); // 160000 - 80000

      const cancelledItem = result.items.find((it) => it.noPesanan === "ORD-CANCELLED-2");
      expect(cancelledItem).toBeDefined();
      // Requirement: Jika status pesanan tidak sama dengan "Selesai", maka Pendapatan Kotor = 0!
      expect(cancelledItem?.pendapatanKotor).toBe(0);
      expect(cancelledItem?.alasanPembatalan).toBe("Pembeli berubah pikiran");

      // 2. Verify Summary Cards calculations
      const summary = result.summary;
      expect(summary.totalPendapatanKotor).toBe(160000);
      expect(summary.totalHpp).toBe(80000);
      expect(summary.totalBiayaLainnya).toBe(90000); // 50000 + 25000 + 15000

      // Total Pendapatan (Setelah Dikurangi HPP) = Total Kotor - Total HPP - Total Biaya Lainnya
      // 160000 - 80000 - 90000 = -10000
      expect(summary.totalPendapatanSetelahHpp).toBe(-10000);

      // Persentase = (Total Pendapatan / Total Pendapatan Kotor) * 100
      // -10000 / 160000 * 100 = -6.25%
      expect(summary.persentasePendapatanBersih).toBeCloseTo(-6.25);

      // Order counts
      expect(summary.jumlahPesanan).toBe(2);
      expect(summary.pesananSelesai).toBe(1);
      expect(summary.pesananBatal).toBe(1);
    });
  });

  describe("Pagination & Sorting", () => {
    it("should respect page size and pagination parameters (10, 25, 50)", async () => {
      mockPrisma.integration.findUnique.mockResolvedValue({ id: "shop-1" });
      mockPrisma.productVariant.findMany.mockResolvedValue([]);
      mockPrisma.shopeeMonthlyExpense.findFirst.mockResolvedValue(null);

      // Generate 25 mock items
      const mockItems = Array.from({ length: 25 }, (_, i) => ({
        orderSn: `ORD-${i + 1}`,
        createTime: 1726000000 + i * 3600,
        orderStatus: i % 2 === 0 ? "COMPLETED" : "READY_TO_SHIP",
        cancelReason: "",
        productName: `Produk ${i + 1}`,
        sku: `SKU-${i + 1}`,
        quantity: 1,
        grossIncome: 50000,
      }));

      vi.spyOn(service as any, "pullOrdersFromShopee").mockResolvedValue(mockItems);

      // Page 1 with limit 10
      const page1 = await service.fetchLiveOrders({
        integrationId: "shop-1",
        month: "2026-09",
        page: 1,
        limit: 10,
        refresh: true,
      });

      expect(page1.items.length).toBe(10);
      expect(page1.pagination.total).toBe(25);
      expect(page1.pagination.totalPages).toBe(3);
      expect(page1.pagination.page).toBe(1);

      // Page 2 with limit 10
      const page2 = await service.fetchLiveOrders({
        integrationId: "shop-1",
        month: "2026-09",
        page: 2,
        limit: 10,
      });

      expect(page2.items.length).toBe(10);
      expect(page2.pagination.page).toBe(2);

      // Limit 25
      const pageAll = await service.fetchLiveOrders({
        integrationId: "shop-1",
        month: "2026-09",
        page: 1,
        limit: 25,
      });

      expect(pageAll.items.length).toBe(25);
      expect(pageAll.pagination.totalPages).toBe(1);
    });
  });

  describe("Monthly Expenses CRUD", () => {
    it("should create new monthly expense if not exists", async () => {
      mockPrisma.shopeeMonthlyExpense.findFirst.mockResolvedValue(null);
      mockPrisma.shopeeMonthlyExpense.create.mockResolvedValue({
        id: "exp-1",
        integrationId: "shop-1",
        month: "2026-09",
        adCost: 100000,
        operationalCost: 50000,
        unexpectedCost: 20000,
      });

      const res = await service.upsertMonthlyExpense({
        integrationId: "shop-1",
        month: "2026-09",
        adCost: 100000,
        operationalCost: 50000,
        unexpectedCost: 20000,
      });

      expect(mockPrisma.shopeeMonthlyExpense.create).toHaveBeenCalledWith({
        data: {
          integrationId: "shop-1",
          month: "2026-09",
          adCost: 100000,
          operationalCost: 50000,
          unexpectedCost: 20000,
          notes: undefined,
        },
      });
      expect(res.adCost).toBe(100000);
    });

    it("should update existing monthly expense if already exists", async () => {
      mockPrisma.shopeeMonthlyExpense.findFirst.mockResolvedValue({
        id: "exp-existing",
      });
      mockPrisma.shopeeMonthlyExpense.update.mockResolvedValue({
        id: "exp-existing",
        adCost: 200000,
      });

      await service.upsertMonthlyExpense({
        integrationId: "shop-1",
        month: "2026-09",
        adCost: 200000,
        operationalCost: 60000,
        unexpectedCost: 30000,
      });

      expect(mockPrisma.shopeeMonthlyExpense.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "exp-existing" },
          data: expect.objectContaining({
            adCost: 200000,
            operationalCost: 60000,
            unexpectedCost: 30000,
          }),
        })
      );
    });
  });
});
