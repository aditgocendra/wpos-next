import bcrypt from "bcrypt";
import { prisma as defaultPrisma } from "@/lib/prisma";
import type { Role, Warehouse } from "@/generated/prisma/client";

export interface SafeUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  warehouseId: string | null;
  warehouse?: Warehouse | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthService {
  constructor(private db = defaultPrisma) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async getUserByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        warehouse: true,
      },
    });
  }

  async getUserById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      include: {
        warehouse: true,
      },
    });
  }

  async validateCredentials(
    email: string,
    password: string
  ): Promise<SafeUser | null> {
    if (!email || !password) {
      return null;
    }

    const user = await this.getUserByEmail(email);
    if (!user || !user.password) {
      return null;
    }

    const isMatch = await this.comparePassword(password, user.password);
    if (!isMatch) {
      return null;
    }

    const { password: _password, ...safeUser } = user;
    void _password;
    return safeUser as SafeUser;
  }
}

export const authService = new AuthService();
