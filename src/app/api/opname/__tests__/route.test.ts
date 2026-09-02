import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getList, POST as createOpname } from "../route";
import { GET as getDetail, PUT as updateOpname, DELETE as deleteOpname } from "../[id]/route";
import { getServerSession } from "next-auth";
import { opnameService } from "@/services/opname.service";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/services/opname.service", () => ({
  opnameService: {
    getOpnames: vi.fn(),
    getOpnameById: vi.fn(),
    createOpname: vi.fn(),
    updateOpname: vi.fn(),
    deleteOpname: vi.fn(),
  },
}));

describe("API /api/opname Route Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/opname", () => {
    it("should return 403 if unauthenticated or CASHIER role", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new Request("http://localhost:3000/api/opname");
      const res = await getList(req);

      expect(res.status).toBe(403);
    });

    it("should return 200 and opname list for SUPER_ADMIN", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "u-1", role: "SUPER_ADMIN" },
      } as any);

      vi.mocked(opnameService.getOpnames).mockResolvedValue({
        data: [{ id: "op-1", opnameNumber: "OP-001" }] as any,
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });

      const req = new Request("http://localhost:3000/api/opname?page=1&limit=10");
      const res = await getList(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
    });
  });

  describe("POST /api/opname", () => {
    it("should return 403 if unauthenticated", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      const req = new Request("http://localhost:3000/api/opname", {
        method: "POST",
        body: JSON.stringify({ warehouseId: "wh-1", items: [] }),
      });
      const res = await createOpname(req);

      expect(res.status).toBe(403);
    });

    it("should return 201 and created opname on success", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "u-1", role: "SUPER_ADMIN" },
      } as any);

      vi.mocked(opnameService.createOpname).mockResolvedValue({
        id: "op-1",
        opnameNumber: "OP-001",
      } as any);

      const req = new Request("http://localhost:3000/api/opname", {
        method: "POST",
        body: JSON.stringify({
          warehouseId: "wh-1",
          items: [{ productId: "p1", variantId: "v1", systemStock: 10, actualStock: 8 }],
        }),
      });

      const res = await createOpname(req);
      const json = await res.json();

      expect(res.status).toBe(201);
      expect(json.data.id).toBe("op-1");
    });
  });

  describe("GET /api/opname/[id]", () => {
    it("should return 200 and detail data", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "u-1", role: "SUPER_ADMIN" },
      } as any);

      vi.mocked(opnameService.getOpnameById).mockResolvedValue({
        id: "op-1",
        opnameNumber: "OP-001",
      } as any);

      const req = new Request("http://localhost:3000/api/opname/op-1");
      const res = await getDetail(req, { params: Promise.resolve({ id: "op-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.id).toBe("op-1");
    });
  });

  describe("PUT /api/opname/[id]", () => {
    it("should return 200 on successful update", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "u-1", role: "SUPER_ADMIN" },
      } as any);

      vi.mocked(opnameService.updateOpname).mockResolvedValue({
        id: "op-1",
        status: "COMPLETED",
      } as any);

      const req = new Request("http://localhost:3000/api/opname/op-1", {
        method: "PUT",
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const res = await updateOpname(req, { params: Promise.resolve({ id: "op-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.status).toBe("COMPLETED");
    });
  });

  describe("DELETE /api/opname/[id]", () => {
    it("should return 200 on successful delete", async () => {
      vi.mocked(getServerSession).mockResolvedValue({
        user: { id: "u-1", role: "SUPER_ADMIN" },
      } as any);

      vi.mocked(opnameService.deleteOpname).mockResolvedValue({ id: "op-1" } as any);

      const req = new Request("http://localhost:3000/api/opname/op-1", { method: "DELETE" });
      const res = await deleteOpname(req, { params: Promise.resolve({ id: "op-1" }) });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.message).toContain("berhasil dihapus");
    });
  });
});
