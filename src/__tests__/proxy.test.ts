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
    it("should return 401 JSON for unauthenticated API requests", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(null);

      const req = createMockRequest("http://localhost:3000/api/warehouses");
      const res = await proxy(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Unauthorized");
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
    it("CASHIER: should allow /, /pos, and /transaction", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const reqHome = createMockRequest("http://localhost:3000/");
      const resHome = await proxy(reqHome);
      expect(resHome.headers.get("location")).toBeNull();

      const reqPos = createMockRequest("http://localhost:3000/pos");
      const resPos = await proxy(reqPos);
      expect(resPos.headers.get("location")).toBeNull();

      const reqTrx = createMockRequest("http://localhost:3000/transaction");
      const resTrx = await proxy(reqTrx);
      expect(resTrx.headers.get("location")).toBeNull();
    });

    it("CASHIER: should allow cashier APIs and block user management API with 403", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const reqTrxApi = createMockRequest("http://localhost:3000/api/transactions");
      const resTrxApi = await proxy(reqTrxApi);
      expect(resTrxApi.status).toBe(200);

      const reqUsersApi = createMockRequest("http://localhost:3000/api/users");
      const resUsersApi = await proxy(reqUsersApi);
      expect(resUsersApi.status).toBe(403);
    });

    it("CASHIER: should redirect from unauthorized pages to /", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-1", "CASHIER")
      );

      const reqWh = createMockRequest("http://localhost:3000/warehouses");
      const resWh = await proxy(reqWh);
      expect(resWh.headers.get("location")).toBe("http://localhost:3000/");

      const reqInv = createMockRequest("http://localhost:3000/inventory");
      const resInv = await proxy(reqInv);
      expect(resInv.headers.get("location")).toBe("http://localhost:3000/");

      const reqCat = createMockRequest("http://localhost:3000/categories");
      const resCat = await proxy(reqCat);
      expect(resCat.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("WAREHOUSE_ADMIN: should allow /, /transfers, /transfer, and /inventory", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const reqDashboard = createMockRequest("http://localhost:3000/");
      const resDashboard = await proxy(reqDashboard);
      expect(resDashboard.headers.get("location")).toBeNull();

      const req2 = createMockRequest("http://localhost:3000/transfers");
      const res2 = await proxy(req2);
      expect(res2.headers.get("location")).toBeNull();

      const req2b = createMockRequest("http://localhost:3000/transfer");
      const res2b = await proxy(req2b);
      expect(res2b.headers.get("location")).toBeNull();

      const req3 = createMockRequest("http://localhost:3000/inventory");
      const res3 = await proxy(req3);
      expect(res3.headers.get("location")).toBeNull();
    });

    it("WAREHOUSE_ADMIN: should redirect from hidden pages (warehouse, categories, pos, users) to /", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const reqWh = createMockRequest("http://localhost:3000/warehouses");
      const resWh = await proxy(reqWh);
      expect(resWh.headers.get("location")).toBe("http://localhost:3000/");

      const reqWhSingle = createMockRequest("http://localhost:3000/warehouse");
      const resWhSingle = await proxy(reqWhSingle);
      expect(resWhSingle.headers.get("location")).toBe("http://localhost:3000/");

      const reqCat = createMockRequest("http://localhost:3000/categories");
      const resCat = await proxy(reqCat);
      expect(resCat.headers.get("location")).toBe("http://localhost:3000/");

      const reqPos = createMockRequest("http://localhost:3000/pos");
      const resPos = await proxy(reqPos);
      expect(resPos.headers.get("location")).toBe("http://localhost:3000/");

      const reqUsers = createMockRequest("http://localhost:3000/users");
      const resUsers = await proxy(reqUsers);
      expect(resUsers.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("WAREHOUSE_ADMIN: should allow warehouse, transfer, inventory, category APIs and block users API", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-2", "WAREHOUSE_ADMIN")
      );

      const reqWhApi = createMockRequest("http://localhost:3000/api/warehouses");
      const resWhApi = await proxy(reqWhApi);
      expect(resWhApi.status).toBe(200);

      const reqCatApi = createMockRequest("http://localhost:3000/api/categories");
      const resCatApi = await proxy(reqCatApi);
      expect(resCatApi.status).toBe(200);

      const reqUsersApi = createMockRequest("http://localhost:3000/api/users");
      const resUsersApi = await proxy(reqUsersApi);
      expect(resUsersApi.status).toBe(403);
    });

    it("SUPER_ADMIN: should allow all routes and APIs", async () => {
      vi.mocked(nextAuthJwt.getToken).mockResolvedValue(
        createMockToken("user-3", "SUPER_ADMIN")
      );

      const routes = [
        "http://localhost:3000/warehouses",
        "http://localhost:3000/transfers",
        "http://localhost:3000/pos",
        "http://localhost:3000/dashboard",
        "http://localhost:3000/users",
        "http://localhost:3000/categories",
        "http://localhost:3000/inventory",
        "http://localhost:3000/api/users",
        "http://localhost:3000/api/warehouses",
        "http://localhost:3000/api/categories",
        "http://localhost:3000/api/inventory",
        "http://localhost:3000/api/transfers",
      ];

      for (const route of routes) {
        const req = createMockRequest(route);
        const res = await proxy(req);
        expect(res.headers.get("location")).toBeNull();
      }
    });
  });
});
