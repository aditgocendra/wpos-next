import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Role, UserStatus } from "@/generated/prisma/client";

export interface WarehouseAdminUser {
  id: string;
  name: string | null;
  email: string;
  status: UserStatus;
  warehouseId: string | null;
  warehouse?: {
    id: string;
    name: string;
  } | null;
}

export interface WarehouseUserInfo {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: UserStatus;
}

export interface WarehouseItem {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  productsCount: number;
  adminUser: WarehouseUserInfo | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWarehouseInput {
  name: string;
  code: string;
  address?: string | null;
  adminUserId?: string | null;
}

export interface UpdateWarehouseInput {
  name?: string;
  code?: string;
  address?: string | null;
  adminUserId?: string | null;
}

export class WarehouseService {
  constructor(private db = defaultPrisma) {}

  private mapToWarehouseItem(warehouse: {
    id: string;
    name: string;
    code: string | null;
    address: string | null;
    createdAt: Date;
    updatedAt: Date;
    users?: WarehouseUserInfo[] | null;
    _count?: {
      productVariantStocks: number;
    };
  }): WarehouseItem {
    const adminUser = warehouse.users?.find((u) => u.role === "WAREHOUSE_ADMIN") || warehouse.users?.[0] || null;
    return {
      id: warehouse.id,
      name: warehouse.name,
      code: warehouse.code,
      address: warehouse.address,
      productsCount: warehouse._count?.productVariantStocks ?? 0,
      adminUser,
      createdAt: warehouse.createdAt,
      updatedAt: warehouse.updatedAt,
    };
  }

  async getAllWarehouses(): Promise<WarehouseItem[]> {
    const warehouses = await this.db.warehouse.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            productVariantStocks: true,
          },
        },
      },
    });

    return warehouses.map((wh) => this.mapToWarehouseItem(wh));
  }

  async getWarehouseById(id: string): Promise<WarehouseItem | null> {
    const warehouse = await this.db.warehouse.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            productVariantStocks: true,
          },
        },
      },
    });

    if (!warehouse) return null;
    return this.mapToWarehouseItem(warehouse);
  }

  async getWarehouseAdminUsers(): Promise<WarehouseAdminUser[]> {
    const users = await this.db.user.findMany({
      where: {
        role: "WAREHOUSE_ADMIN",
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        warehouseId: true,
        warehouse: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return users as WarehouseAdminUser[];
  }

  async createWarehouse(input: CreateWarehouseInput): Promise<WarehouseItem> {
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();
    const address = input.address ? input.address.trim() : null;

    if (!name) {
      throw new Error("Warehouse name is required");
    }

    if (!code) {
      throw new Error("Warehouse code is required");
    }

    const existing = await this.db.warehouse.findUnique({
      where: { code },
    });

    if (existing) {
      throw new Error("Warehouse code already exists");
    }

    const warehouse = await this.db.warehouse.create({
      data: {
        name,
        code,
        address,
      },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            productVariantStocks: true,
          },
        },
      },
    });

    // If an admin user is selected, assign them to this warehouse
    if (input.adminUserId) {
      const adminUser = await this.db.user.findUnique({
        where: { id: input.adminUserId },
      });

      if (adminUser && adminUser.role === "WAREHOUSE_ADMIN") {
        await this.db.user.update({
          where: { id: input.adminUserId },
          data: { warehouseId: warehouse.id },
        });

        // Re-fetch warehouse to include the assigned admin
        const refreshed = await this.getWarehouseById(warehouse.id);
        if (refreshed) return refreshed;
      }
    }

    return this.mapToWarehouseItem(warehouse);
  }

  async updateWarehouse(
    id: string,
    input: UpdateWarehouseInput
  ): Promise<WarehouseItem> {
    const existing = await this.db.warehouse.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Warehouse not found");
    }

    const updateData: {
      name?: string;
      code?: string;
      address?: string | null;
    } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) throw new Error("Warehouse name cannot be empty");
      updateData.name = name;
    }

    if (input.code !== undefined) {
      const code = input.code.trim().toUpperCase();
      if (!code) throw new Error("Warehouse code cannot be empty");

      if (code !== existing.code) {
        const duplicate = await this.db.warehouse.findUnique({
          where: { code },
        });
        if (duplicate && duplicate.id !== id) {
          throw new Error("Warehouse code already exists");
        }
      }
      updateData.code = code;
    }

    if (input.address !== undefined) {
      updateData.address = input.address ? input.address.trim() : null;
    }

    await this.db.warehouse.update({
      where: { id },
      data: updateData,
    });

    // Handle admin user assignment/reassignment if specified
    if (input.adminUserId !== undefined) {
      const currentAdmin = existing.users?.find((u) => u.role === "WAREHOUSE_ADMIN");
      if (input.adminUserId) {
        // Disassociate previous warehouse admin user from this warehouse if different
        if (currentAdmin && currentAdmin.id !== input.adminUserId) {
          await this.db.user.update({
            where: { id: currentAdmin.id },
            data: { warehouseId: null },
          });
        }

        // Assign the new admin user
        await this.db.user.update({
          where: { id: input.adminUserId },
          data: { warehouseId: id },
        });
      } else {
        // Unassign currently assigned admin user
        if (currentAdmin) {
          await this.db.user.update({
            where: { id: currentAdmin.id },
            data: { warehouseId: null },
          });
        }
      }
    }

    const updated = await this.getWarehouseById(id);
    if (!updated) {
      throw new Error("Warehouse not found after update");
    }
    return updated;
  }

  async deleteWarehouse(id: string): Promise<{ success: boolean }> {
    const existing = await this.db.warehouse.findUnique({
      where: { id },
      include: {
        users: true,
      },
    });

    if (!existing) {
      throw new Error("Warehouse not found");
    }

    // Explicitly unassign users if exist
    await this.db.user.updateMany({
      where: { warehouseId: id },
      data: { warehouseId: null },
    });

    await this.db.warehouse.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const warehouseService = new WarehouseService();
