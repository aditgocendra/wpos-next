import { describe, it, expect, vi, beforeEach } from "vitest";
import { UserService } from "../user.service";
import type { Role, UserStatus, User, Warehouse } from "@/generated/prisma/client";

describe("UserService Unit Tests", () => {
  let userService: UserService;
  let mockPrisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    warehouse: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleWarehouse: Warehouse = {
    id: "wh-1",
    name: "Gudang Pusat",
    code: "WH-001",
    address: "Jl. Sudirman",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const sampleUser: User & { warehouse?: Warehouse | null } = {
    id: "u-1",
    name: "John Doe",
    email: "john@example.com",
    password: "$2b$10$hashedpassword123",
    role: "WAREHOUSE_ADMIN" as Role,
    status: "ACTIVE" as UserStatus,
    warehouseId: "wh-1",
    warehouse: sampleWarehouse,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      warehouse: {
        findMany: vi.fn(),
      },
    };
    userService = new UserService(mockPrisma as unknown as ConstructorParameters<typeof UserService>[0]);
  });

  describe("getAllUsers", () => {
    it("should return users without exposing password", async () => {
      mockPrisma.user.findMany.mockResolvedValue([sampleUser]);

      const result = await userService.getAllUsers();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("u-1");
      expect(result[0].email).toBe("john@example.com");
      expect(result[0].status).toBe("ACTIVE");
      expect(result[0].warehouse?.name).toBe("Gudang Pusat");
      expect((result[0] as unknown as Record<string, unknown>).password).toBeUndefined();
    });
  });

  describe("getAllWarehouses", () => {
    it("should return warehouses for dropdown selection", async () => {
      mockPrisma.warehouse.findMany.mockResolvedValue([
        { id: "wh-1", name: "Gudang Pusat", code: "WH-001" },
      ]);

      const result = await userService.getAllWarehouses();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Gudang Pusat");
    });
  });

  describe("createUser", () => {
    it("should successfully create user with hashed password and warehouse assignment", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...sampleUser,
        email: "new@example.com",
      });

      const result = await userService.createUser({
        name: "New Admin",
        email: "New@Example.Com",
        password: "securepassword",
        role: "WAREHOUSE_ADMIN",
        warehouseId: "wh-1",
        status: "ACTIVE",
      });

      expect(result.email).toBe("new@example.com");
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "new@example.com" },
      });
      expect(mockPrisma.user.create).toHaveBeenCalled();
    });

    it("should throw error if email is already registered", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);

      await expect(
        userService.createUser({
          email: "john@example.com",
          password: "password123",
          role: "CASHIER",
        })
      ).rejects.toThrow("Email already registered");
    });

    it("should clear warehouseId if role is not WAREHOUSE_ADMIN", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...sampleUser,
        role: "CASHIER",
        warehouseId: null,
        warehouse: null,
      });

      await userService.createUser({
        email: "cashier@example.com",
        password: "password123",
        role: "CASHIER",
        warehouseId: "wh-1",
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: "CASHIER",
            warehouseId: null,
          }),
        })
      );
    });
  });

  describe("updateUser", () => {
    it("should update user fields successfully", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser,
        name: "Updated Name",
        status: "INACTIVE",
      });

      const result = await userService.updateUser("u-1", {
        name: "Updated Name",
        status: "INACTIVE",
      });

      expect(result.name).toBe("Updated Name");
      expect(result.status).toBe("INACTIVE");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "u-1" },
        })
      );
    });

    it("should throw error if user not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        userService.updateUser("non-existent", { name: "Test" })
      ).rejects.toThrow("User not found");
    });
  });

  describe("deleteUser", () => {
    it("should successfully delete a user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);
      mockPrisma.user.delete.mockResolvedValue(sampleUser);

      const result = await userService.deleteUser("u-1", "u-superadmin");
      expect(result).toEqual({ success: true });
      expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: "u-1" } });
    });

    it("should prevent self-deletion", async () => {
      await expect(userService.deleteUser("u-1", "u-1")).rejects.toThrow(
        "Cannot delete currently logged-in user"
      );
    });
  });

  describe("toggleUserStatus", () => {
    it("should toggle status from ACTIVE to INACTIVE", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser,
        status: "INACTIVE",
      });

      const result = await userService.toggleUserStatus("u-1");
      expect(result.status).toBe("INACTIVE");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "INACTIVE" },
        })
      );
    });

    it("should set explicit status if provided", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(sampleUser);
      mockPrisma.user.update.mockResolvedValue({
        ...sampleUser,
        status: "ACTIVE",
      });

      const result = await userService.toggleUserStatus("u-1", "ACTIVE");
      expect(result.status).toBe("ACTIVE");
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: "ACTIVE" },
        })
      );
    });
  });
});
