import { describe, it, expect, vi, beforeEach } from "vitest";
import { proxy } from "../proxy";
import { NextRequest } from "next/server";
import * as nextAuthJwt from "next-auth/jwt";
import type { JWT } from "next-auth/jwt";
import type { Role } from "@/generated/prisma/client";

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}));

function createMockRequest(url: string) {
  return new NextRequest(new URL(url, "http://localhost:3000"));
}

function createMockToken(id: string, role: Role, warehouseId: string | null = null): JWT {
  return {
    id,
    role,
    warehouseId,
  };
}

describe("Proxy & RBAC Route Protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Public Assets and Static Paths", () => {
    it("should allow /api/auth routes without checking token", async () => {
      const req = createMockRequest("http://localhost:3000/api/auth/session");
      const res = await proxy(req);

      expect(nextAuthJwt.getToken).not.toHaveBeenCalled();
      expect(res.headers.get("location")).toBeNull();
    });

    it("should allow /_next static files without checking token", async () => {
      const req = createMockRequest("http://localhost:3000/_next/static/chunks/main.js");
      const res = await proxy(req);

      expect(nextAuthJwt.getToken).not.toHaveBeenCalled();
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Unauthenticated Access", () => {
    it("should redirect unauthenticated users on protected routes to /sign-in with callbackUrl", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(null);

      const req = createMockRequest("http://localhost:3000/warehouses");
      const res = await proxy(req);

      const location = res.headers.get("location");
      expect(location).toBeDefined();
      expect(location).toContain("/sign-in");
      expect(location).toContain("callbackUrl=%2Fwarehouses");
    });

    it("should allow unauthenticated users to access /sign-in", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(null);

      const req = createMockRequest("http://localhost:3000/sign-in");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Authenticated User Visiting /sign-in", () => {
    it("should redirect CASHIER from /sign-in to /pos", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const req = createMockRequest("http://localhost:3000/sign-in");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/pos");
    });

    it("should redirect WAREHOUSE_ADMIN from /sign-in to /", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const req = createMockRequest("http://localhost:3000/sign-in");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("should redirect SUPER_ADMIN from /sign-in to /", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-3", "SUPER_ADMIN")
      );

      const req = createMockRequest("http://localhost:3000/sign-in");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });
  });

  describe("Role-Based Access Control (RBAC)", () => {
    it("CASHIER: should allow /pos", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const req = createMockRequest("http://localhost:3000/pos");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBeNull();
    });

    it("CASHIER: should redirect from /warehouses to /pos", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const req = createMockRequest("http://localhost:3000/warehouses");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/pos");
    });

    it("WAREHOUSE_ADMIN: should allow /, /warehouses and /transfers", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const reqDashboard = createMockRequest("http://localhost:3000/");
      const resDashboard = await proxy(reqDashboard);
      expect(resDashboard.headers.get("location")).toBeNull();

      const req1 = createMockRequest("http://localhost:3000/warehouses");
      const res1 = await proxy(req1);
      expect(res1.headers.get("location")).toBeNull();

      const req1b = createMockRequest("http://localhost:3000/warehouse");
      const res1b = await proxy(req1b);
      expect(res1b.headers.get("location")).toBeNull();

      const req2 = createMockRequest("http://localhost:3000/transfers");
      const res2 = await proxy(req2);
      expect(res2.headers.get("location")).toBeNull();
    });

    it("WAREHOUSE_ADMIN: should redirect from /pos to /", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const req = createMockRequest("http://localhost:3000/pos");
      const res = await proxy(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("SUPER_ADMIN: should allow all routes", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-3", "SUPER_ADMIN")
      );

      const routes = [
        "http://localhost:3000/warehouses",
        "http://localhost:3000/transfers",
        "http://localhost:3000/pos",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/users",
      ];

      for (const route of routes) {
        const req = createMockRequest(route);
        const res = await proxy(req);
        expect(res.headers.get("location")).toBeNull();
      }
    });
  });
});
