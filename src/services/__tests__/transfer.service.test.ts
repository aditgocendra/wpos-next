import { describe, it, expect, vi, beforeEach } from "vitest";
import { TransferService } from "../transfer.service";

describe("TransferService Unit Tests", () => {
  let transferService: TransferService;
  let mockPrisma: any;

  const sampleWarehouseSource = {
    id: "wh-source",
    name: "Gudang Utama",
    code: "WH-SRC",
  };

  const sampleWarehouseDest = {
    id: "wh-dest",
    name: "Gudang Cabang",
    code: "WH-DST",
  };

  const sampleUser = {
    id: "usr-admin",
    name: "Admin User",
    email: "admin@wpos.com",
  };

  const sampleProductSource = {
    id: "prod-1",
    name: "Kemeja Flanel",
    categoryId: "cat-cloth",
    warehouseId: "wh-source",
    totalStock: 50,
    avgCostPrice: 100000,
  };

  const sampleVariantSource = {
    id: "var-1",
    productId: "prod-1",
    variantName: "Size L Red",
    sku: "CLO-FLA-L-RED",
    stock: 20,
    priceSell: 150000,
    priceCost: 100000,
    product: sampleProductSource,
  };

  const sampleTransfer = {
    id: "trf-123",
    transferNumber: "TRF-20260823-1234",
    sourceWarehouseId: "wh-source",
    destinationWarehouseId: "wh-dest",
    sourceWarehouse: sampleWarehouseSource,
    destinationWarehouse: sampleWarehouseDest,
    status: "PENDING" as const,
    notes: "Pengiriman stok mingguan",
    createdById: "usr-admin",
    createdBy: sampleUser,
    updatedById: null,
    updatedBy: null,
    items: [
      {
        id: "item-1",
        transferId: "trf-123",
        productId: "prod-1",
        variantId: "var-1",
        quantity: 5,
        product: { id: "prod-1", name: "Kemeja Flanel" },
        variant: { id: "var-1", variantName: "Size L Red", sku: "CLO-FLA-L-RED" },
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
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      productVariant: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      stockTransfer: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      stockTransferItem: {
        createMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      $transaction: vi.fn((callback) => callback(mockPrisma)),
    };

    transferService = new TransferService(mockPrisma as any);
  });

  describe("createTransferOrder", () => {
    it("should successfully create a draft transfer order", async () => {
      mockPrisma.warehouse.findUnique.mockImplementation(({ where }: any) => {
        if (where.id === "wh-source") return Promise.resolve(sampleWarehouseSource);
        if (where.id === "wh-dest") return Promise.resolve(sampleWarehouseDest);
        return Promise.resolve(null);
      });

      mockPrisma.productVariant.findUnique.mockResolvedValue(sampleVariantSource);
      mockPrisma.stockTransfer.create.mockResolvedValue(sampleTransfer);

      const result = await transferService.createTransferOrder(
        {
          sourceWarehouseId: "wh-source",
          destinationWarehouseId: "wh-dest",
          items: [{ productId: "prod-1", variantId: "var-1", quantity: 5 }],
          notes: "Pengiriman stok mingguan",
        },
        "usr-admin"
      );

      expect(result.id).toBe("trf-123");
      expect(result.status).toBe("PENDING");
      expect(result.totalQuantity).toBe(5);
      expect(mockPrisma.stockTransfer.create).toHaveBeenCalled();
    });

    it("should throw error if source and destination warehouses are the same", async () => {
      await expect(
        transferService.createTransferOrder(
          {
            sourceWarehouseId: "wh-same",
            destinationWarehouseId: "wh-same",
            items: [{ productId: "prod-1", variantId: "var-1", quantity: 5 }],
          },
          "usr-admin"
        )
      ).rejects.toThrow("Gudang asal dan gudang tujuan tidak boleh sama");
    });

    it("should throw error if transfer quantity exceeds available stock at source warehouse", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouseSource);
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...sampleVariantSource,
        stock: 2, // Available is 2
      });

      await expect(
        transferService.createTransferOrder(
          {
            sourceWarehouseId: "wh-source",
            destinationWarehouseId: "wh-dest",
            items: [{ productId: "prod-1", variantId: "var-1", quantity: 10 }], // Requested is 10
          },
          "usr-admin"
        )
      ).rejects.toThrow("Stok varian \"Size L Red\" di gudang asal tidak mencukupi");
    });
  });

  describe("executeTransfer (CRITICAL LOGIC)", () => {
    it("should execute transfer atomically and update stock in source and destination warehouses", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue(sampleTransfer);
      mockPrisma.productVariant.findUnique.mockResolvedValue(sampleVariantSource);

      mockPrisma.product.findFirst.mockResolvedValue(null);
      mockPrisma.product.create.mockResolvedValue({
        id: "prod-dest-1",
        name: "Kemeja Flanel",
        categoryId: "cat-cloth",
        warehouseId: "wh-dest",
        totalStock: 0,
        avgCostPrice: 100000,
      });

      mockPrisma.productVariant.findFirst.mockResolvedValue(null);
      mockPrisma.productVariant.create.mockResolvedValue({
        id: "var-dest-1",
        productId: "prod-dest-1",
        variantName: "Size L Red",
        sku: "CLO-FLA-L-RED", // Exact same SKU
        stock: 5,
        priceSell: 150000,
        priceCost: 100000,
      });

      mockPrisma.productVariant.findMany.mockResolvedValue([
        { stock: 5, priceCost: 100000 },
      ]);

      mockPrisma.stockTransfer.update.mockResolvedValue({
        ...sampleTransfer,
        status: "TRANSFERED",
      });

      const result = await transferService.executeTransfer("trf-123", "usr-admin");

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      // Decrement source variant
      expect(mockPrisma.productVariant.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "var-1" },
          data: { stock: { decrement: 5 } },
        })
      );
      // Decrement source product
      expect(mockPrisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "prod-1" },
          data: { totalStock: { decrement: 5 } },
        })
      );
      // Create destination variant with EXACT same SKU
      expect(mockPrisma.productVariant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sku: "CLO-FLA-L-RED",
            stock: 5,
          }),
        })
      );
      expect(result.status).toBe("TRANSFERED");
    });

    it("should throw INSUFFICIENT_STOCK error if stock is insufficient during executeTransfer", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue(sampleTransfer);
      // Source variant stock has dropped to 2
      mockPrisma.productVariant.findUnique.mockResolvedValue({
        ...sampleVariantSource,
        stock: 2,
      });

      await expect(
        transferService.executeTransfer("trf-123", "usr-admin")
      ).rejects.toThrow(/INSUFFICIENT_STOCK/);
    });

    it("should throw error if transfer status is already TRANSFERED", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue({
        ...sampleTransfer,
        status: "TRANSFERED",
      });

      await expect(
        transferService.executeTransfer("trf-123", "usr-admin")
      ).rejects.toThrow("Transfer tidak dapat dieksekusi karena status saat ini: TRANSFERED");
    });
  });

  describe("cancelTransfer", () => {
    it("should cancel pending transfer", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue(sampleTransfer);
      mockPrisma.stockTransfer.update.mockResolvedValue({
        ...sampleTransfer,
        status: "CANCELLED",
        notes: "Pengiriman dibatalkan",
      });

      const result = await transferService.cancelTransfer(
        "trf-123",
        "usr-admin",
        "Alasan pembatalan"
      );

      expect(result.status).toBe("CANCELLED");
    });
  });

  describe("deleteTransfer", () => {
    it("should allow Super Admin to delete pending transfer", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue(sampleTransfer);
      mockPrisma.stockTransfer.delete.mockResolvedValue(sampleTransfer);

      const result = await transferService.deleteTransfer("trf-123", "SUPER_ADMIN");
      expect(result).toBe(true);
      expect(mockPrisma.stockTransfer.delete).toHaveBeenCalledWith({
        where: { id: "trf-123" },
      });
    });

    it("should reject non Super Admin from deleting transfer", async () => {
      await expect(
        transferService.deleteTransfer("trf-123", "WAREHOUSE_ADMIN")
      ).rejects.toThrow("Hanya Super Admin yang dapat menghapus transfer stok");
    });

    it("should allow Super Admin to delete transfer even if status is TRANSFERED", async () => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue({
        ...sampleTransfer,
        status: "TRANSFERED",
      });
      mockPrisma.stockTransfer.delete.mockResolvedValue(sampleTransfer);

      const result = await transferService.deleteTransfer("trf-123", "SUPER_ADMIN");
      expect(result).toBe(true);
      expect(mockPrisma.stockTransfer.delete).toHaveBeenCalledWith({
        where: { id: "trf-123" },
      });
    });
  });
});
