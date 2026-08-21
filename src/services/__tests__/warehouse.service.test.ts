import { describe, it, expect, vi, beforeEach } from "vitest";
import { WarehouseService } from "../warehouse.service";
import type { Role, UserStatus } from "@/generated/prisma/client";

describe("WarehouseService Unit Tests", () => {
  let warehouseService: WarehouseService;
  let mockPrisma: {
    warehouse: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleAdminUser = {
    id: "user-admin-1",
    name: "Warehouse Admin User",
    email: "whadmin@example.com",
    role: "WAREHOUSE_ADMIN" as Role,
    status: "ACTIVE" as UserStatus,
  };

  const sampleWarehouse = {
    id: "wh-1",
    name: "Gudang Utama",
    code: "WH-UTAMA",
    address: "Jl. Merdeka No. 10",
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
    admin: sampleAdminUser,
  };

  beforeEach(() => {
    mockPrisma = {
      warehouse: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };
    warehouseService = new WarehouseService(
      mockPrisma as unknown as ConstructorParameters<typeof WarehouseService>[0]
    );
  });

  describe("getAllWarehouses", () => {
    it("should return all warehouses with assigned admin mapped correctly", async () => {
      mockPrisma.warehouse.findMany.mockResolvedValue([sampleWarehouse]);

      const result = await warehouseService.getAllWarehouses();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("wh-1");
      expect(result[0].name).toBe("Gudang Utama");
      expect(result[0].code).toBe("WH-UTAMA");
      expect(result[0].address).toBe("Jl. Merdeka No. 10");
      expect(result[0].adminUser?.name).toBe("Warehouse Admin User");
      expect(result[0].productsCount).toBe(0);
    });

    it("should return null for adminUser if warehouse has no admin assigned", async () => {
      mockPrisma.warehouse.findMany.mockResolvedValue([
        {
          ...sampleWarehouse,
          admin: null,
        },
      ]);

      const result = await warehouseService.getAllWarehouses();
      expect(result).toHaveLength(1);
      expect(result[0].adminUser).toBeNull();
    });
  });

  describe("getWarehouseById", () => {
    it("should return warehouse item when found", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);

      const result = await warehouseService.getWarehouseById("wh-1");
      expect(result).not.toBeNull();
      expect(result?.id).toBe("wh-1");
      expect(result?.name).toBe("Gudang Utama");
    });

    it("should return null when warehouse is not found", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      const result = await warehouseService.getWarehouseById("wh-999");
      expect(result).toBeNull();
    });
  });

  describe("getWarehouseAdminUsers", () => {
    it("should return users with role WAREHOUSE_ADMIN", async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: "u-1",
          name: "Admin One",
          email: "admin1@example.com",
          status: "ACTIVE",
          warehouseId: "wh-1",
          warehouse: { id: "wh-1", name: "Gudang Utama" },
        },
      ]);

      const result = await warehouseService.getWarehouseAdminUsers();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Admin One");
      expect(result[0].email).toBe("admin1@example.com");
    });
  });

  describe("createWarehouse", () => {
    it("should create a warehouse successfully without admin user", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);
      mockPrisma.warehouse.create.mockResolvedValue({
        id: "wh-2",
        name: "Gudang Cabang",
        code: "WH-CABANG",
        address: "Jl. Sudirman",
        createdAt: new Date(),
        updatedAt: new Date(),
        admin: null,
      });

      const result = await warehouseService.createWarehouse({
        name: "  Gudang Cabang  ",
        code: "wh-cabang",
        address: "  Jl. Sudirman  ",
      });

      expect(mockPrisma.warehouse.create).toHaveBeenCalledWith({
        data: {
          name: "Gudang Cabang",
          code: "WH-CABANG",
          address: "Jl. Sudirman",
        },
        include: expect.any(Object),
      });
      expect(result.name).toBe("Gudang Cabang");
      expect(result.code).toBe("WH-CABANG");
    });

    it("should create a warehouse and assign admin user if provided", async () => {
      mockPrisma.warehouse.findUnique
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce({
          ...sampleWarehouse,
          id: "wh-new",
          admin: sampleAdminUser,
        }); // getWarehouseById refresh
      mockPrisma.warehouse.create.mockResolvedValue({
        id: "wh-new",
        name: "Gudang Baru",
        code: "WH-BARU",
        address: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        admin: null,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "user-admin-1",
        role: "WAREHOUSE_ADMIN",
      });

      const result = await warehouseService.createWarehouse({
        name: "Gudang Baru",
        code: "WH-BARU",
        adminUserId: "user-admin-1",
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-admin-1" },
        data: { warehouseId: "wh-new" },
      });
      expect(result.id).toBe("wh-new");
    });

    it("should throw error if code already exists", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);

      await expect(
        warehouseService.createWarehouse({
          name: "Duplicate WH",
          code: "WH-UTAMA",
        })
      ).rejects.toThrow("Warehouse code already exists");
    });

    it("should throw error if name or code is empty", async () => {
      await expect(
        warehouseService.createWarehouse({
          name: "   ",
          code: "WH-TEST",
        })
      ).rejects.toThrow("Warehouse name is required");

      await expect(
        warehouseService.createWarehouse({
          name: "Test WH",
          code: "   ",
        })
      ).rejects.toThrow("Warehouse code is required");
    });
  });

  describe("updateWarehouse", () => {
    it("should update warehouse details and admin user assignment", async () => {
      mockPrisma.warehouse.findUnique
        .mockResolvedValueOnce(sampleWarehouse) // existing check
        .mockResolvedValueOnce({
          ...sampleWarehouse,
          name: "Gudang Utama Renamed",
          admin: {
            id: "user-admin-2",
            name: "New Admin",
            email: "newadmin@example.com",
            role: "WAREHOUSE_ADMIN",
            status: "ACTIVE",
          },
        }); // refreshed check

      const result = await warehouseService.updateWarehouse("wh-1", {
        name: "Gudang Utama Renamed",
        adminUserId: "user-admin-2",
      });

      expect(mockPrisma.warehouse.update).toHaveBeenCalledWith({
        where: { id: "wh-1" },
        data: { name: "Gudang Utama Renamed" },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-admin-1" },
        data: { warehouseId: null },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-admin-2" },
        data: { warehouseId: "wh-1" },
      });
      expect(result.name).toBe("Gudang Utama Renamed");
    });

    it("should throw error if updating non-existent warehouse", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(
        warehouseService.updateWarehouse("wh-999", {
          name: "Does not exist",
        })
      ).rejects.toThrow("Warehouse not found");
    });
  });

  describe("deleteWarehouse", () => {
    it("should delete warehouse and unassign admin user", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(sampleWarehouse);
      mockPrisma.warehouse.delete.mockResolvedValue(sampleWarehouse);

      const result = await warehouseService.deleteWarehouse("wh-1");
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-admin-1" },
        data: { warehouseId: null },
      });
      expect(mockPrisma.warehouse.delete).toHaveBeenCalledWith({
        where: { id: "wh-1" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should throw error if deleting non-existent warehouse", async () => {
      mockPrisma.warehouse.findUnique.mockResolvedValue(null);

      await expect(warehouseService.deleteWarehouse("wh-999")).rejects.toThrow(
        "Warehouse not found"
      );
    });
  });
});
