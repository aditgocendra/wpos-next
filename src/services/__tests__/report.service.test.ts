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
    });
  });
});
