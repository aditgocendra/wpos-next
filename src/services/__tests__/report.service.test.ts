import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReportService } from "../report.service";

describe("ReportService Unit Tests", () => {
  let reportService: ReportService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const sampleWarehouse = {
    id: "wh-1",
    name: "Gudang Pusat",
    code: "WH-01",
  };

  const sampleCategory = {
    id: "cat-1",
    name: "Pakaian",
    code: "CAT-PAK",
  };

  const sampleProduct = {
    id: "prod-1",
    name: "Kemeja Casual",
    categoryId: "cat-1",
    category: sampleCategory,
  };

  const sampleVariant = {
    id: "var-1",
    productId: "prod-1",
    variantName: "Hitam L",
    sku: "KEM-CAS-BLK-L",
    priceSell: 150000,
    priceCost: 100000,
  };

  beforeEach(() => {
    mockPrisma = {
      transactionItem: {
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
    };
    reportService = new ReportService(mockPrisma);
  });

  describe("getProductReport", () => {
    it("should aggregate items by product variant and warehouse correctly", async () => {
      const mockItems = [
        {
          id: "ti-1",
          productId: "prod-1",
          variantId: "var-1",
          quantity: 2,
          price: 150000,
          totalPrice: 300000,
          costPrice: 100000,
          product: sampleProduct,
          variant: sampleVariant,
          transaction: {
            id: "trx-1",
            createdAt: new Date("2026-08-20T10:00:00Z"),
            warehouseId: "wh-1",
            warehouse: sampleWarehouse,
          },
        },
        {
          id: "ti-2",
          productId: "prod-1",
          variantId: "var-1",
          quantity: 3,
          price: 150000,
          totalPrice: 450000,
          costPrice: 100000,
          product: sampleProduct,
          variant: sampleVariant,
          transaction: {
            id: "trx-2",
            createdAt: new Date("2026-08-22T14:00:00Z"),
            warehouseId: "wh-1",
            warehouse: sampleWarehouse,
          },
        },
      ];

      mockPrisma.transactionItem.findMany.mockResolvedValue(mockItems);

      const result = await reportService.getProductReport({});

      expect(mockPrisma.transactionItem.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].productName).toBe("Kemeja Casual");
      expect(result[0].quantitySold).toBe(5);
      expect(result[0].totalAmount).toBe(750000);
      expect(result[0].categoryName).toBe("Pakaian");
      expect(result[0].warehouseName).toBe("Gudang Pusat");
    });

    it("should apply date, category, and warehouse filters", async () => {
      mockPrisma.transactionItem.findMany.mockResolvedValue([]);

      await reportService.getProductReport({
        startDate: "2026-08-01",
        endDate: "2026-08-28",
        categoryId: "cat-1",
        warehouseId: "wh-1",
        search: "Kemeja",
        sortBy: "productName",
        sortOrder: "asc",
      });

      expect(mockPrisma.transactionItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            transaction: expect.objectContaining({
              warehouseId: "wh-1",
              createdAt: expect.any(Object),
            }),
            product: expect.objectContaining({
              categoryId: "cat-1",
              name: {
                contains: "Kemeja",
                mode: "insensitive",
              },
            }),
          }),
        })
      );
    });
  });

  describe("getTransactionReport", () => {
    it("should return transactions with formatted items", async () => {
      const mockTransactions = [
        {
          id: "trx-1",
          transactionNumber: "TRX-20260828-1001",
          warehouseId: "wh-1",
          warehouse: sampleWarehouse,
          totalAmount: 300000,
          createdAt: new Date("2026-08-28T10:00:00Z"),
          createdBy: { name: "Kasir 1", email: "kasir@wpos.com" },
          items: [
            {
              id: "ti-1",
              productId: "prod-1",
              variantId: "var-1",
              quantity: 2,
              price: 150000,
              totalPrice: 300000,
              product: sampleProduct,
              variant: sampleVariant,
            },
          ],
        },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await reportService.getTransactionReport({});

      expect(mockPrisma.transaction.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].transactionNumber).toBe("TRX-20260828-1001");
      expect(result[0].totalQuantity).toBe(2);
      expect(result[0].totalAmount).toBe(300000);
      expect(result[0].productNames).toBe("Kemeja Casual");
      expect(result[0].totalCost).toBe(0);
      expect(result[0].profit).toBe(300000);
    });

    it("should calculate totalCost (hpp * qty) and profit (harga jual akhir setelah diskon - totalCost) correctly", async () => {
      const mockTransactions = [
        {
          id: "trx-profit",
          transactionNumber: "TRX-20260828-PROFIT",
          warehouseId: "wh-1",
          warehouse: sampleWarehouse,
          totalAmount: 280000, // Harga jual akhir setelah diskon (300k - 20k)
          discount: 20000,
          createdAt: new Date("2026-08-28T10:00:00Z"),
          createdBy: { name: "Kasir 1", email: "kasir@wpos.com" },
          items: [
            {
              id: "ti-profit-1",
              productId: "prod-1",
              variantId: "var-1",
              quantity: 2,
              price: 150000,
              totalPrice: 300000,
              costPrice: 100000, // HPP per unit
              product: sampleProduct,
              variant: sampleVariant,
            },
          ],
        },
      ];

      mockPrisma.transaction.findMany.mockResolvedValue(mockTransactions);

      const result = await reportService.getTransactionReport({});

      expect(result).toHaveLength(1);
      const trx = result[0];
      expect(trx.items[0].costPrice).toBe(100000);
      expect(trx.items[0].totalCost).toBe(200000); // 100,000 * 2
      expect(trx.totalCost).toBe(200000); // sum of (hpp * qty)
      expect(trx.totalAmount).toBe(280000); // harga jual akhir setelah diskon
      expect(trx.discount).toBe(20000);
      expect(trx.profit).toBe(80000); // 280,000 - 200,000
    });

    it("should sort transactions by profit and totalCost correctly", async () => {
      const trxHighProfit = {
        id: "trx-high",
        transactionNumber: "TRX-HIGH",
        warehouseId: "wh-1",
        warehouse: sampleWarehouse,
        totalAmount: 500000,
        discount: 0,
        createdAt: new Date("2026-08-28T10:00:00Z"),
        createdBy: { name: "Kasir 1", email: "kasir@wpos.com" },
        items: [
          {
            id: "ti-high",
            productId: "prod-1",
            variantId: "var-1",
            quantity: 1,
            price: 500000,
            totalPrice: 500000,
            costPrice: 100000,
            product: sampleProduct,
            variant: sampleVariant,
          },
        ],
      };

      const trxLowProfit = {
        id: "trx-low",
        transactionNumber: "TRX-LOW",
        warehouseId: "wh-1",
        warehouse: sampleWarehouse,
        totalAmount: 150000,
        discount: 0,
        createdAt: new Date("2026-08-28T10:00:00Z"),
        createdBy: { name: "Kasir 1", email: "kasir@wpos.com" },
        items: [
          {
            id: "ti-low",
            productId: "prod-1",
            variantId: "var-1",
            quantity: 1,
            price: 150000,
            totalPrice: 150000,
            costPrice: 120000,
            product: sampleProduct,
            variant: sampleVariant,
          },
        ],
      };

      mockPrisma.transaction.findMany.mockResolvedValue([trxLowProfit, trxHighProfit]);

      // Sort by profit desc
      const sortedByProfitDesc = await reportService.getTransactionReport({
        sortBy: "profit",
        sortOrder: "desc",
      });

      expect(sortedByProfitDesc[0].transactionNumber).toBe("TRX-HIGH"); // profit: 400,000
      expect(sortedByProfitDesc[1].transactionNumber).toBe("TRX-LOW"); // profit: 30,000
    });
  });
});
