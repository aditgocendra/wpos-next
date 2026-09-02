import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpnameService } from "../opname.service";

describe("OpnameService Unit Tests", () => {
  let opnameService: OpnameService;
  let mockPrisma: any;

  const sampleWarehouse = {
    id: "wh-1",
    name: "Gudang Utama",
    code: "GDU",
  };

  const sampleUserAdmin = {
    id: "usr-admin",
    role: "SUPER_ADMIN",
    warehouseId: null,
  };

  const sampleUserWhAdmin = {
    id: "usr-wh",
    role: "WAREHOUSE_ADMIN",
    warehouseId: "wh-1",
  };

  const sampleOpname = {
    id: "op-1",
    opnameNumber: "OP-GDU-20260902-001",
    warehouseId: "wh-1",
    status: "DRAFT",
    notes: "Audit bulanan",
    createdById: "usr-admin",
    items: [
      {
        id: "item-1",
        opnameId: "op-1",
        productId: "prod-1",
        variantId: "var-1",
        systemStock: 10,
        actualStock: 8,
        difference: -2,
        notes: "2 barang rusak",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      warehouse: {
        findUnique: vi.fn().mockResolvedValue(sampleWarehouse),
      },
      stockOpname: {
        count: vi.fn().mockResolvedValue(1),
        findMany: vi.fn().mockResolvedValue([sampleOpname]),
        findUnique: vi.fn().mockResolvedValue(sampleOpname),
        create: vi.fn().mockResolvedValue(sampleOpname),
        update: vi.fn().mockResolvedValue({ ...sampleOpname, status: "COMPLETED" }),
        delete: vi.fn().mockResolvedValue(sampleOpname),
      },
      stockOpnameItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      productVariantStock: {
        upsert: vi.fn().mockResolvedValue({ id: "pvs-1" }),
      },
      $transaction: vi.fn(async (cb) => {
        if (typeof cb === "function") {
          return await cb(mockPrisma);
        }
        return cb;
      }),
    };

    opnameService = new OpnameService(mockPrisma);
  });

  describe("getOpnames", () => {
    it("should return opnames list with pagination", async () => {
      const result = await opnameService.getOpnames({ page: 1, limit: 10 }, sampleUserAdmin);

      expect(mockPrisma.stockOpname.count).toHaveBeenCalled();
      expect(mockPrisma.stockOpname.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it("should enforce user.warehouseId if role is WAREHOUSE_ADMIN", async () => {
      await opnameService.getOpnames({ warehouseId: "wh-other" }, sampleUserWhAdmin);

      expect(mockPrisma.stockOpname.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: "wh-1",
          }),
        })
      );
    });
  });

  describe("getOpnameById", () => {
    it("should return opname detail if found", async () => {
      const result = await opnameService.getOpnameById("op-1", sampleUserAdmin);
      expect(result.id).toBe("op-1");
    });

    it("should throw error if opname not found", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue(null);
      await expect(opnameService.getOpnameById("op-99", sampleUserAdmin)).rejects.toThrow(
        "Stock opname tidak ditemukan"
      );
    });

    it("should throw error if WAREHOUSE_ADMIN accesses opname of different warehouse", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        warehouseId: "wh-other",
      });

      await expect(opnameService.getOpnameById("op-1", sampleUserWhAdmin)).rejects.toThrow(
        "Forbidden: Anda tidak memiliki akses ke stock opname gudang ini"
      );
    });
  });

  describe("createOpname", () => {
    it("should throw error if warehouseId is missing", async () => {
      await expect(
        opnameService.createOpname(
          { warehouseId: "", items: [{ productId: "p1", variantId: "v1", systemStock: 10, actualStock: 8 }] },
          sampleUserAdmin
        )
      ).rejects.toThrow("Gudang wajib dipilih");
    });

    it("should throw error if WAREHOUSE_ADMIN tries to create opname for another warehouse", async () => {
      await expect(
        opnameService.createOpname(
          {
            warehouseId: "wh-other",
            items: [{ productId: "p1", variantId: "v1", systemStock: 10, actualStock: 8 }],
          },
          sampleUserWhAdmin
        )
      ).rejects.toThrow("Forbidden: Anda hanya dapat membuat stock opname untuk gudang Anda sendiri");
    });

    it("should throw error if items are empty", async () => {
      await expect(
        opnameService.createOpname({ warehouseId: "wh-1", items: [] }, sampleUserAdmin)
      ).rejects.toThrow("Stock opname wajib memiliki minimal 1 item barang");
    });

    it("should calculate difference and create opname in DRAFT status without updating physical stock", async () => {
      const result = await opnameService.createOpname(
        {
          warehouseId: "wh-1",
          status: "DRAFT",
          notes: "Audit",
          items: [
            {
              productId: "prod-1",
              variantId: "var-1",
              systemStock: 10,
              actualStock: 7,
              notes: "3 rusak",
            },
          ],
        },
        sampleUserAdmin
      );

      expect(mockPrisma.stockOpname.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warehouseId: "wh-1",
            status: "DRAFT",
            items: {
              create: [
                expect.objectContaining({
                  productId: "prod-1",
                  variantId: "var-1",
                  systemStock: 10,
                  actualStock: 7,
                  difference: -3,
                  notes: "3 rusak",
                }),
              ],
            },
          }),
        })
      );
      expect(mockPrisma.productVariantStock.upsert).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should synchronize ProductVariantStock when created with status COMPLETED", async () => {
      await opnameService.createOpname(
        {
          warehouseId: "wh-1",
          status: "COMPLETED",
          items: [
            {
              productId: "prod-1",
              variantId: "var-1",
              systemStock: 10,
              actualStock: 15,
            },
          ],
        },
        sampleUserAdmin
      );

      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith({
        where: {
          variantId_warehouseId: {
            variantId: "var-1",
            warehouseId: "wh-1",
          },
        },
        create: {
          variantId: "var-1",
          warehouseId: "wh-1",
          stock: 15,
        },
        update: {
          stock: 15,
        },
      });
    });
  });

  describe("updateOpname", () => {
    it("should throw error if opname is already COMPLETED", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        status: "COMPLETED",
      });

      await expect(
        opnameService.updateOpname("op-1", { notes: "Ubah" }, sampleUserAdmin)
      ).rejects.toThrow("Stock opname yang sudah selesai (COMPLETED) tidak dapat diubah lagi");
    });

    it("should throw error if opname is already CANCELLED", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        status: "CANCELLED",
      });

      await expect(
        opnameService.updateOpname("op-1", { notes: "Ubah" }, sampleUserAdmin)
      ).rejects.toThrow("Stock opname yang sudah dibatalkan (CANCELLED) tidak dapat diubah lagi");
    });

    it("should synchronize ProductVariantStock when transition to COMPLETED status", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        status: "DRAFT",
        warehouseId: "wh-1",
        items: [
          {
            productId: "prod-1",
            variantId: "var-1",
            systemStock: 10,
            actualStock: 12,
            difference: 2,
          },
        ],
      });

      await opnameService.updateOpname("op-1", { status: "COMPLETED" }, sampleUserAdmin);

      expect(mockPrisma.productVariantStock.upsert).toHaveBeenCalledWith({
        where: {
          variantId_warehouseId: {
            variantId: "var-1",
            warehouseId: "wh-1",
          },
        },
        create: {
          variantId: "var-1",
          warehouseId: "wh-1",
          stock: 12,
        },
        update: {
          stock: 12,
        },
      });
      expect(mockPrisma.stockOpname.update).toHaveBeenCalled();
    });
  });

  describe("deleteOpname", () => {
    it("should delete DRAFT opname successfully", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        status: "DRAFT",
      });

      await opnameService.deleteOpname("op-1", sampleUserAdmin);
      expect(mockPrisma.stockOpname.delete).toHaveBeenCalledWith({ where: { id: "op-1" } });
    });

    it("should throw error if attempting to delete COMPLETED opname", async () => {
      mockPrisma.stockOpname.findUnique.mockResolvedValue({
        ...sampleOpname,
        status: "COMPLETED",
      });

      await expect(opnameService.deleteOpname("op-1", sampleUserAdmin)).rejects.toThrow(
        "Stock opname yang sudah selesai (COMPLETED) tidak dapat dihapus"
      );
    });
  });
});
