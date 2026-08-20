import { describe, it, expect, vi, beforeEach } from "vitest";
import { authOptions } from "@/lib/auth";
import { AuthService } from "@/services/auth.service";
import type { Role } from "@/generated/prisma/client";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

interface ProviderWithAuthorize {
  id: string;
  name: string;
  options?: {
    authorize?: (
      credentials: Record<string, string> | undefined,
      req: unknown
    ) => Promise<unknown>;
  };
  authorize?: (
    credentials: Record<string, string> | undefined,
    req: unknown
  ) => Promise<unknown>;
}

describe("NextAuth Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("CredentialsProvider Authorize Handler", () => {
    const credentialsProvider = authOptions.providers.find(
      (p) => p.id === "credentials" || p.name === "Credentials"
    ) as unknown as ProviderWithAuthorize;

    const getAuthorize = () =>
      credentialsProvider?.options?.authorize || credentialsProvider?.authorize;

    it("should be configured in authOptions", () => {
      expect(credentialsProvider).toBeDefined();
      expect(getAuthorize()).toBeDefined();
    });

    it("should authorize successfully with valid credentials and return formatted user", async () => {
      const mockSafeUser = {
        id: "user-super-1",
        email: "admin@wpos.com",
        name: "Super Admin",
        role: "SUPER_ADMIN" as Role,
        warehouseId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(AuthService.prototype, "validateCredentials").mockResolvedValue(
        mockSafeUser
      );

      const authorize = getAuthorize();
      const result = (await authorize!(
        { email: "admin@wpos.com", password: "password123" },
        {}
      )) as (User & { role: Role; warehouseId: string | null }) | null;

      expect(result).toBeDefined();
      expect(result?.id).toBe("user-super-1");
      expect(result?.email).toBe("admin@wpos.com");
      expect(result?.role).toBe("SUPER_ADMIN");
      expect(result?.warehouseId).toBeNull();
    });

    it("should reject and return null on invalid credentials", async () => {
      vi.spyOn(AuthService.prototype, "validateCredentials").mockResolvedValue(null);

      const authorize = getAuthorize();
      const result = await authorize!(
        { email: "admin@wpos.com", password: "wrong" },
        {}
      );

      expect(result).toBeNull();
    });

    it("should reject and return null when credentials are missing", async () => {
      const authorize = getAuthorize();
      const result = await authorize!(
        { email: "", password: "" },
        {}
      );

      expect(result).toBeNull();
    });
  });

  describe("NextAuth Callbacks", () => {
    it("should forward user id, role, and warehouseId into the JWT token", async () => {
      const jwtCallback = authOptions.callbacks?.jwt;
      expect(jwtCallback).toBeDefined();

      const user = {
        id: "user-wh-1",
        name: "Warehouse Admin",
        email: "wh@wpos.com",
        role: "WAREHOUSE_ADMIN" as Role,
        warehouseId: "wh-123",
      };

      const initialToken = { sub: "user-wh-1" } as JWT;
      const token = await jwtCallback!({
        token: initialToken,
        user: user as User,
        account: null,
      });

      expect(token.id).toBe("user-wh-1");
      expect(token.role).toBe("WAREHOUSE_ADMIN");
      expect(token.warehouseId).toBe("wh-123");
    });

    it("should forward token id, role, and warehouseId into the Session user object", async () => {
      const sessionCallback = authOptions.callbacks?.session;
      expect(sessionCallback).toBeDefined();

      const token: JWT = {
        id: "user-cashier-1",
        role: "CASHIER" as Role,
        warehouseId: "wh-456",
      };

      const initialSession: Session = {
        user: {
          id: "user-cashier-1",
          role: "CASHIER" as Role,
          warehouseId: "wh-456",
          name: "Cashier",
          email: "cashier@wpos.com",
        },
        expires: new Date(Date.now() + 3600000).toISOString(),
      };

      const session = await sessionCallback!({
        session: initialSession,
        token: token,
        user: {} as User,
        newSession: undefined,
        trigger: "update",
      });

      const user = session?.user;
      expect(user?.id).toBe("user-cashier-1");
      expect(user?.role).toBe("CASHIER");
      expect(user?.warehouseId).toBe("wh-456");
    });
  });
});
