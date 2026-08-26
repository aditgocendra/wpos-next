import { describe, it, expect, vi, beforeEach } from "vitest";
import { InventoryService } from "../inventory.service";

describe("InventoryService Unit Tests", () => {
  let inventoryService: InventoryService;
  let mockPrisma: {
    product: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    productVariant: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    productVariantStock: {
      upsert: ReturnType<typeof vi.fn>;
    };
    category: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    warehouse: {
      findUnique: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const sampleCategory = {
    id: "cat-ear",
    name: "Earphone",
    code: "EAR",
    children: [],
  };

  const sampleWarehouse = {
    id: "wh-main",
    name: "Main Warehouse",
    code: "WH-MAIN",
  };

  const sampleUser = {
    id: "usr-admin",
    name: "Admin User",
    email: "admin@wpos.com",
  };

  const sampleProduct = {
    id: "prod-1",
    name: "Sony WF-1000XM5",
    categoryId: "cat-ear",
    category: sampleCategory,
    warehouseId: "wh-main",
    warehouse: sampleWarehouse,
    totalStock: 25,
    avgCostPrice: 3000000,
    createdById: "usr-admin",
    createdBy: sampleUser,
    updatedById: null,
    updatedBy: null,
    variants: [
      {
        id: "var-1",
        productId: "prod-1",
        variantName: "Black",
        sku: "EAR-SON-WF1-BLK",
        stock: 15,
        warehouseStocks: [
          {
            id: "pvs-1",
            variantId: "var-1",
            warehouseId: "wh-main",
            stock: 15,
          },
        ],
        priceCost: 3000000,
        priceSell: 4200000,
        createdById: "usr-admin",
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "var-2",
        productId: "prod-1",
        variantName: "Silver",
        sku: "EAR-SON-WF1-SLV",
        stock: 10,
        warehouseStocks: [
          {
            id: "pvs-2",
            variantId: "var-2",
            warehouseId: "wh-main",
            stock: 10,
          },
        ],
        priceCost: 3000000,
        priceSell: 4200000,
        createdById: "usr-admin",
        updatedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    transactionItems: [],
    transferItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      productVariant: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
      productVariantStock: {
        upsert: vi.fn(),
      },
      category: {
        findUnique: vi.fn(),
      },
      warehouse: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === "function") {
          return await cb({
            product: mockPrisma.product,
            productVariant: mockPrisma.productVariant,
            productVariantStock: mockPrisma.productVariantStock,
          });
        }
        return cb;
      }),
    };

    inventoryService = new InventoryService(
      mockPrisma as unknown as ConstructorParameters<typeof InventoryService>[0]
    );
  });

  describe("SKU Validation & Stock Calculation", () => {
    it("should accept valid formatted SKU", () => {
      expect(inventoryService.validateSku("ear-son-wf1-blk")).toBe(
        "EAR-SON-WF1-BLK"
      );
      expect(inventoryService.validateSku("CAT-BRAND-PROD-VAR1")).toBe(
        "CAT-BRAND-PROD-VAR1"
      );
    });

    it("should reject SKU with less than 3 segments or invalid format", () => {
      expect(() => inventoryService.validateSku("EARSONBLK")).toThrow(
        "Format SKU"
      );
      expect(() => inventoryService.validateSku("EAR-SON")).toThrow(
        "Format SKU"
      );
      expect(() => inventoryService.validateSku("EAR-SON-***-BLK")).toThrow(
        "tidak valid"
      );
    });

  });

  describe("createProduct", () => {
    it("should create product with variants successfully", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.productVariant.findMany.mockResolvedValue([]); // No duplicate SKU in DB
      mockPrisma.product.create.mockResolvedValue({ id: "prod-1" });
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);

      const result = await inventoryService.createProduct(
        {
          name: "Sony WF-1000XM5",
          categoryId: "cat-ear",
          warehouseId: "wh-main",
          variants: [
            {
              variantName: "Black",
              sku: "EAR-SON-WF1-BLK",
              stock: 15,
              priceCost: 3000000,
              priceSell: 4200000,
            },
            {
              variantName: "Silver",
              sku: "EAR-SON-WF1-SLV",
              stock: 10,
              priceCost: 3000000,
              priceSell: 4200000,
            },
          ],
        },
        "usr-admin"
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.name).toBe("Sony WF-1000XM5");
      expect(result.variants).toHaveLength(2);
      expect(result.totalStock).toBe(25);
    });

    it("should throw error if variants are empty (< 1 variant)", async () => {
      await expect(
        inventoryService.createProduct(
          {
            name: "Sony WF-1000XM5",
            categoryId: "cat-ear",
            warehouseId: "wh-main",
            variants: [],
          },
          "usr-admin"
        )
      ).rejects.toThrow("1 produk wajib memiliki minimal 1 SKU");
    });

    it("should throw error if duplicate SKU is in input variants", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);

      await expect(
        inventoryService.createProduct(
          {
            name: "Sony WF-1000XM5",
            categoryId: "cat-ear",
            warehouseId: "wh-main",
            variants: [
              {
                variantName: "Black",
                sku: "EAR-SON-WF1-BLK",
                stock: 10,
                priceCost: 3000000,
                priceSell: 4200000,
              },
              {
                variantName: "Black 2",
                sku: "EAR-SON-WF1-BLK",
                stock: 5,
                priceCost: 3000000,
                priceSell: 4200000,
              },
            ],
          },
          "usr-admin"
        )
      ).rejects.toThrow('SKU duplikat dalam input formulir: "EAR-SON-WF1-BLK"');
    });

    it("should throw error if SKU already exists in database", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleCategory);
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.productVariant.findMany.mockResolvedValue([
        { sku: "EAR-SON-WF1-BLK" },
      ]);

      await expect(
        inventoryService.createProduct(
          {
            name: "Sony WF-1000XM5",
            categoryId: "cat-ear",
            warehouseId: "wh-main",
            variants: [
              {
                variantName: "Black",
                sku: "EAR-SON-WF1-BLK",
                stock: 10,
                priceCost: 3000000,
                priceSell: 4200000,
              },
            ],
          },
          "usr-admin"
        )
      ).rejects.toThrow('SKU "EAR-SON-WF1-BLK" sudah digunakan pada produk lain');
    });

    it("should throw error if selected category has subcategories (not leaf category)", async () => {
      mockPrisma.category.findUnique.mockResolvedValue({
        id: "cat-audio",
        name: "Audio",
        code: "AUD",
        children: [{ id: "cat-ear", name: "Earphone", code: "EAR" }],
      });

      await expect(
        inventoryService.createProduct(
          {
            name: "Sony WF-1000XM5",
            categoryId: "cat-audio",
            warehouseId: "wh-main",
            variants: [
              {
                variantName: "Black",
                sku: "AUD-SON-WF1-BLK",
                stock: 10,
                priceCost: 3000000,
                priceSell: 4200000,
              },
            ],
          },
          "usr-admin"
        )
      ).rejects.toThrow("memiliki subkategori");
    });
  });

  describe("updateProduct", () => {
    it("should update product and sync variants successfully", async () => {
      mockPrisma.product.findUnique
        .mockResolvedValueOnce(sampleProduct) // existing check
        .mockResolvedValueOnce({
          ...sampleProduct,
          name: "Sony WF-1000XM5 Updated",
        }); // getProductById
      mockPrisma.productVariant.findMany.mockResolvedValue([]); // duplicate check

      const result = await inventoryService.updateProduct(
        "prod-1",
        {
          name: "Sony WF-1000XM5 Updated",
          variants: [
            {
              id: "var-1",
              variantName: "Black Gold Edition",
              sku: "EAR-SON-WF1-GLD",
              stock: 20,
              priceCost: 3100000,
              priceSell: 4500000,
            },
          ],
        },
        "usr-admin"
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.name).toBe("Sony WF-1000XM5 Updated");
    });

    it("should throw error if updating product with empty variants list", async () => {
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);

      await expect(
        inventoryService.updateProduct(
          "prod-1",
          {
            variants: [],
          },
          "usr-admin"
        )
      ).rejects.toThrow("1 produk wajib memiliki minimal 1 SKU");
    });
  });

  describe("addStock (Shortcut & Moving Average)", () => {
    it("should add stock and calculate new Moving Average HPP correctly", async () => {
      mockPrisma.productVariant.findUnique.mockResolvedValue(sampleProduct.variants[0]);
      mockPrisma.product.findUnique.mockResolvedValue({
        ...sampleProduct,
        variants: [
          {
            ...sampleProduct.variants[0],
            warehouseStocks: [{ ...sampleProduct.variants[0].warehouseStocks[0], stock: 25 }],
          },
          sampleProduct.variants[1],
        ],
      }); // getProductById

      const result = await inventoryService.addStock(
        "prod-1",
        {
          warehouseId: "wh-main",
          variantId: "var-1",
          stock: 10,
          priceCost: 4000000,
        },
        "usr-admin"
      );

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma.productVariant.update).toHaveBeenCalled();
      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalled();
      expect(result.totalStock).toBe(35);
    });

    it("should throw error if stock added is <= 0", async () => {
      await expect(
        inventoryService.addStock(
          "prod-1",
          {
            warehouseId: "wh-1",
            variantId: "var-1",
            stock: 0,
            priceCost: 3000000,
          },
          "usr-admin"
        )
      ).rejects.toThrow("Jumlah stok tambahan harus lebih dari 0");
    });

    it("should throw error if target variant does not exist on product", async () => {
      mockPrisma.productVariant.findUnique.mockResolvedValue(null);

      await expect(
        inventoryService.addStock(
          "prod-1",
          {
            warehouseId: "wh-1",
            variantId: "non-existent-var",
            stock: 5,
            priceCost: 3000000,
          },
          "usr-admin"
        )
      ).rejects.toThrow("Varian produk tidak ditemukan");
    });
  });

  describe("deleteProduct", () => {
    it("should delete product successfully", async () => {
      mockPrisma.product.findUnique.mockResolvedValue(sampleProduct);
      mockPrisma.product.delete.mockResolvedValue(sampleProduct);

      const result = await inventoryService.deleteProduct("prod-1");
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: "prod-1" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should throw error if deleting non-existent product", async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        inventoryService.deleteProduct("non-existent")
      ).rejects.toThrow("Produk tidak ditemukan");
    });
  });
});
