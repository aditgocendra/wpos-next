import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransactionService } from "../transaction.service";

describe("TransactionService Unit Tests", () => {
  let transactionService: TransactionService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: any;

  const sampleWarehouse = {
    id: "wh-1",
    name: "Gudang Utama",
    code: "WH-01",
  };

  const sampleUser = {
    id: "usr-cashier",
    name: "Kasir 1",
    email: "cashier@wpos.com",
  };

  const sampleProduct = {
    id: "prod-1",
    name: "Kemeja Flanel",
    categoryId: "cat-1",
    warehouseId: "wh-1",
    totalStock: 50,
    avgCostPrice: 100000,
  };

  const sampleVariant = {
    id: "var-1",
    productId: "prod-1",
    variantName: "Size L Red",
    sku: "CLO-FLA-L-RED",
    stock: 20,
    warehouseStocks: [
      {
        id: "pvs-1",
        variantId: "var-1",
        warehouseId: "wh-1",
        stock: 20,
      },
    ],
    priceSell: 150000,
    priceCost: 100000,
    product: sampleProduct,
  };

  const sampleTransaction = {
    id: "trx-123",
    transactionNumber: "TRX-20260824-1001",
    warehouseId: "wh-1",
    warehouse: sampleWarehouse,
    totalAmount: 300000,
    notes: "Pembayaran Tunai",
    createdById: "usr-cashier",
    createdBy: sampleUser,
    updatedById: null,
    updatedBy: null,
    items: [
      {
        id: "item-1",
        transactionId: "trx-123",
        productId: "prod-1",
        variantId: "var-1",
        quantity: 2,
        price: 150000,
        totalPrice: 300000,
        costPrice: 100000,
        product: { id: "prod-1", name: "Kemeja Flanel" },
        variant: {
          id: "var-1",
          variantName: "Size L Red",
          sku: "CLO-FLA-L-RED",
          priceSell: 150000,
          priceCost: 100000,
        },
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      warehouse: {
        findUnique: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      productVariantStock: {
        update: vi.fn(),
        upsert: vi.fn(),
      },
      transaction: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      transactionItem: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      $transaction: vi.fn((callback: any) => callback(mockPrisma)),
    };

    transactionService = new TransactionService(mockPrisma);
  });

  describe("getTransactions", () => {
    it("should return formatted transactions list with filters", async () => {
      mockPrisma.transaction.findMany.mockResolvedValue([sampleTransaction]);

      const result = await transactionService.getTransactions({
        warehouseId: "wh-1",
        search: "Flanel",
      });

      expect(result).toHaveLength(1);
      expect(result[0].transactionNumber).toBe("TRX-20260824-1001");
      expect(result[0].totalAmount).toBe(300000);
      expect(result[0].productNames).toEqual(["Kemeja Flanel"]);
      expect(mockPrisma.transaction.findMany).toHaveBeenCalled();
    });

    it("should sort by product name correctly", async () => {
      const trx2 = {
        ...sampleTransaction,
        id: "trx-2",
        items: [
          {
            ...sampleTransaction.items[0],
            product: { id: "prod-2", name: "Apple iPhone" },
          },
        ],
      };

      mockPrisma.transaction.findMany.mockResolvedValue([sampleTransaction, trx2]);

      const result = await transactionService.getTransactions({
        sortBy: "productName",
        sortOrder: "asc",
      });

      expect(result[0].productNames[0]).toBe("Apple iPhone");
      expect(result[1].productNames[0]).toBe("Kemeja Flanel");
    });
  });

  describe("getTransactionById", () => {
    it("should return formatted single transaction", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(sampleTransaction);

      const result = await transactionService.getTransactionById("trx-123");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("trx-123");
      expect(result?.totalQuantity).toBe(2);
    });

    it("should return null if transaction not found", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(null);

      const result = await transactionService.getTransactionById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("createTransaction", () => {
    it("should successfully create transaction and deduct variant/product stock atomically", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.productVariant.findUnique.mockResolvedValue(sampleVariant);
      mockPrisma.transaction.create.mockResolvedValue(sampleTransaction);

      const result = await transactionService.createTransaction(
        {
          warehouseId: "wh-1",
          items: [{ productId: "prod-1", variantId: "var-1", quantity: 2 }],
          notes: "Pembayaran Tunai",
        },
        "usr-cashier"
      );

      expect(result.id).toBe("trx-123");
      expect(mockPrisma.productVariantStock.update).toHaveBeenCalledWith({
        where: { id: "pvs-1" },
        data: { stock: { decrement: 2 } },
      });
      expect(mockPrisma.transaction.create).toHaveBeenCalled();
    });

    it("should throw error if warehouse is not found", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        transactionService.createTransaction(
          {
            warehouseId: "invalid-wh",
            items: [{ productId: "prod-1", variantId: "var-1", quantity: 1 }],
          },
          "usr-cashier"
        )
      ).rejects.toThrow("Gudang tidak ditemukan");
    });

    it("should throw error if stock is insufficient", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...sampleVariant,
        warehouseStocks: [
          {
            id: "pvs-1",
            variantId: "var-1",
            warehouseId: "wh-1",
            stock: 1, // Only 1 available, but requested 5
          },
        ],
      });

      await expect(
        transactionService.createTransaction(
          {
            warehouseId: "wh-1",
            items: [{ productId: "prod-1", variantId: "var-1", quantity: 5 }],
          },
          "usr-cashier"
        )
      ).rejects.toThrow("INSUFFICIENT_STOCK");
    });

    it("should throw error if product variant does not match productId", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...sampleVariant,
        productId: "other-prod",
      });

      await expect(
        transactionService.createTransaction(
          {
            warehouseId: "wh-1",
            items: [{ productId: "prod-1", variantId: "var-1", quantity: 1 }],
          },
          "usr-cashier"
        )
      ).rejects.toThrow("tidak cocok");
    });
  });

  describe("updateTransaction", () => {
    it("should rollback old stocks and deduct new stocks on update", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(sampleTransaction);
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...sampleVariant,
        warehouseStocks: [
          {
            id: "pvs-1",
            variantId: "var-1",
            warehouseId: "wh-1",
            stock: 30,
          },
        ],
      });
      mockPrisma.transaction.update.mockResolvedValue({
        ...sampleTransaction,
        totalAmount: 450000,
        items: [
          {
            ...sampleTransaction.items[0],
            quantity: 3,
            totalPrice: 450000,
          },
        ],
      });

      const result = await transactionService.updateTransaction(
        "trx-123",
        {
          items: [{ productId: "prod-1", variantId: "var-1", quantity: 3 }],
          notes: "Updated order",
        },
        "usr-admin"
      );

      // Rollback previous quantity (2) and Deduct new quantity (3) via upsert
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalled();
      expect(result.totalAmount).toBe(450000);
    });
  });

  describe("deleteTransaction", () => {
    it("should restore variant & product stock and delete transaction", async () => {
      mockPrisma.transaction.findUnique.mockResolvedValue(sampleTransaction);

      const result = await transactionService.deleteTransaction("trx-123");

      expect(result).toEqual({ success: true });
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith({
        where: { variantId_warehouseId: { variantId: "var-1", warehouseId: "wh-1" } },
        update: { stock: { increment: 2 } },
        create: { variantId: "var-1", warehouseId: "wh-1", stock: 2 },
      });
      expect(mockPrisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: "trx-123" },
      });
    });
  });
});
