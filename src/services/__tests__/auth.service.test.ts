import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService, type SafeUser } from "../auth.service";
import bcrypt from "bcrypt";
import type { Role, User } from "@/generated/prisma/client";

describe("AuthService Unit Tests", () => {
  let authService: AuthService;
  let mockPrisma: {
    user: {
      findUnique: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: vi.fn(),
      },
    };
    authService = new AuthService(mockPrisma as unknown as ConstructorParameters<typeof AuthService>[0]);
  });

  describe("hashPassword and comparePassword", () => {
    it("should hash a plain text password properly", async () => {
      const password = "SuperSecretPassword123!";
      const hash = await authService.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith("$2")).toBe(true);
    });

    it("should return true when comparing valid password and hash", async () => {
      const password = "myPassword123";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await authService.comparePassword(password, hash);
      expect(isValid).toBe(true);
    });

    it("should return false when comparing invalid password and hash", async () => {
      const password = "myPassword123";
      const wrongPassword = "wrongPassword";
      const hash = await bcrypt.hash(password, 10);

      const isValid = await authService.comparePassword(wrongPassword, hash);
      expect(isValid).toBe(false);
    });
  });

  describe("validateCredentials", () => {
    const mockUser: User = {
      id: "user-123",
      email: "admin@wpos.com",
      name: "Admin User",
      password: "",
      role: "SUPER_ADMIN" as Role,
      warehouseId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(async () => {
      mockUser.password = await bcrypt.hash("password123", 10);
    });

    it("should validate credentials successfully and return sanitized user without password", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateCredentials(
        "admin@wpos.com",
        "password123"
      );

      expect(result).toBeDefined();
      expect(result?.id).toBe("user-123");
      expect(result?.email).toBe("admin@wpos.com");
      expect(result?.role).toBe("SUPER_ADMIN");
      expect((result as unknown as Record<string, unknown>)?.password).toBeUndefined();
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "admin@wpos.com" },
        include: { warehouse: true },
      });
    });

    it("should return null if user is not found in database", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await authService.validateCredentials(
        "notfound@wpos.com",
        "password123"
      );

      expect(result).toBeNull();
    });

    it("should return null if password is incorrect", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateCredentials(
        "admin@wpos.com",
        "wrongpassword"
      );

      expect(result).toBeNull();
    });

    it("should return null if email or password is empty", async () => {
      expect(await authService.validateCredentials("", "password123")).toBeNull();
      expect(await authService.validateCredentials("admin@wpos.com", "")).toBeNull();
    });
  });

  describe("getUserByEmail and getUserById", () => {
    it("should query user by lowercase email", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" } as unknown as SafeUser);

      await authService.getUserByEmail("ADMIN@WPOS.COM");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: "admin@wpos.com" },
        include: { warehouse: true },
      });
    });

    it("should query user by id", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" } as unknown as SafeUser);

      await authService.getUserById("user-1");

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "user-1" },
        include: { warehouse: true },
      });
    });
  });
});
