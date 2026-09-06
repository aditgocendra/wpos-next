import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { getServerSession } from "next-auth";
import { warehouseService } from "@/services/warehouse.service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/services/warehouse.service", () => ({
  warehouseService: {
    bulkCopyProducts: vi.fn(),
  },
}));

describe("POST /api/warehouses/[id]/bulk-copy API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/warehouses/wh-target/bulk-copy", {
      method: "POST",
      body: JSON.stringify({ sourceWarehouseId: "wh-src" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "wh-target" }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Unauthorized");
  });

  it("should return 403 if user is CASHIER", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "CASHIER" },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);

    const req = new Request("http://localhost:3000/api/warehouses/wh-target/bulk-copy", {
      method: "POST",
      body: JSON.stringify({ sourceWarehouseId: "wh-src" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "wh-target" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });

  it("should return 403 if user is WAREHOUSE_ADMIN", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "WAREHOUSE_ADMIN", warehouseId: "wh-own" },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);

    const req = new Request("http://localhost:3000/api/warehouses/wh-own/bulk-copy", {
      method: "POST",
      body: JSON.stringify({ sourceWarehouseId: "wh-src" }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "wh-own" }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Hanya Super Admin");
  });

  it("should return 400 if sourceWarehouseId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);

    const req = new Request("http://localhost:3000/api/warehouses/wh-target/bulk-copy", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "wh-target" }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sourceWarehouseId");
  });

  it("should successfully copy variants and return 200 for SUPER_ADMIN", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
    } as unknown as Awaited<ReturnType<typeof getServerSession>>);

    vi.mocked(warehouseService.bulkCopyProducts).mockResolvedValue({
      copiedCount: 5,
      skippedCount: 2,
      totalSourceVariants: 7,
    });

    const req = new Request("http://localhost:3000/api/warehouses/wh-target/bulk-copy", {
      method: "POST",
      body: JSON.stringify({
        sourceWarehouseId: "wh-src",
        copyStockQuantity: false,
      }),
    });

    const res = await POST(req, {
      params: Promise.resolve({ id: "wh-target" }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.copiedCount).toBe(5);
    expect(data.data.skippedCount).toBe(2);
    expect(data.message).toContain("Berhasil menyalin 5 varian produk");
  });
});
