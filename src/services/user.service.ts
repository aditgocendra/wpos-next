import bcrypt from "bcrypt";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Role, UserStatus, Warehouse } from "@/generated/prisma/client";

export interface UserItem {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: UserStatus;
  warehouseId: string | null;
  warehouse?: Warehouse | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  name?: string | null;
  email: string;
  password: string;
  role: Role;
  warehouseId?: string | null;
  status?: UserStatus;
}

export interface UpdateUserInput {
  name?: string | null;
  email?: string;
  password?: string;
  role?: Role;
  warehouseId?: string | null;
  status?: UserStatus;
}

export class UserService {
  constructor(private db = defaultPrisma) {}

  async getAllUsers(): Promise<UserItem[]> {
    const users = await this.db.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        warehouse: true,
      },
    });

    return users.map(({ password: _password, ...user }) => {
      void _password;
      return user as UserItem;
    });
  }

  async getAllWarehouses() {
    return this.db.warehouse.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });
  }

  async getUserById(id: string): Promise<UserItem | null> {
    const user = await this.db.user.findUnique({
      where: { id },
      include: {
        warehouse: true,
      },
    });

    if (!user) return null;
    const { password: _password, ...safeUser } = user;
    void _password;
    return safeUser as UserItem;
  }

  async createUser(input: CreateUserInput): Promise<UserItem> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.db.user.findUnique({
      where: { email },
    });

    if (existing) {
      throw new Error("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const warehouseId =
      input.role === "WAREHOUSE_ADMIN" ? input.warehouseId || null : null;

    const user = await this.db.user.create({
      data: {
        name: input.name?.trim() || null,
        email,
        password: hashedPassword,
        role: input.role,
        status: input.status || "ACTIVE",
        warehouseId,
      },
      include: {
        warehouse: true,
      },
    });

    const { password: _password, ...safeUser } = user;
    void _password;
    return safeUser as UserItem;
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<UserItem> {
    const existing = await this.db.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("User not found");
    }

    const updateData: {
      name?: string | null;
      email?: string;
      password?: string;
      role?: Role;
      status?: UserStatus;
      warehouseId?: string | null;
    } = {};

    if (input.name !== undefined) {
      updateData.name = input.name ? input.name.trim() : null;
    }

    if (input.email && input.email.trim().toLowerCase() !== existing.email) {
      const email = input.email.trim().toLowerCase();
      const duplicate = await this.db.user.findUnique({
        where: { email },
      });
      if (duplicate && duplicate.id !== id) {
        throw new Error("Email already registered");
      }
      updateData.email = email;
    }

    if (input.password && input.password.trim() !== "") {
      updateData.password = await bcrypt.hash(input.password, 10);
    }

    if (input.role) {
      updateData.role = input.role;
      if (input.role !== "WAREHOUSE_ADMIN") {
        updateData.warehouseId = null;
      } else if (input.warehouseId !== undefined) {
        updateData.warehouseId = input.warehouseId || null;
      }
    } else if (input.warehouseId !== undefined) {
      updateData.warehouseId = input.warehouseId || null;
    }

    if (input.status) {
      updateData.status = input.status;
    }

    const updatedUser = await this.db.user.update({
      where: { id },
      data: updateData,
      include: {
        warehouse: true,
      },
    });

    const { password: _password, ...safeUser } = updatedUser;
    void _password;
    return safeUser as UserItem;
  }

  async deleteUser(id: string, currentUserId?: string): Promise<{ success: boolean }> {
    if (currentUserId && id === currentUserId) {
      throw new Error("Cannot delete currently logged-in user");
    }

    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await this.db.user.delete({
      where: { id },
    });

    return { success: true };
  }

  async toggleUserStatus(id: string, newStatus?: UserStatus): Promise<UserItem> {
    const user = await this.db.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const targetStatus: UserStatus =
      newStatus ?? (user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE");

    const updatedUser = await this.db.user.update({
      where: { id },
      data: { status: targetStatus },
      include: {
        warehouse: true,
      },
    });

    const { password: _password, ...safeUser } = updatedUser;
    void _password;
    return safeUser as UserItem;
  }
}

export const userService = new UserService();
