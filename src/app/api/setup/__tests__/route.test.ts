import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "../route";
import { userService } from "@/services/user.service";

vi.mock("@/services/user.service", () => ({
  userService: {
    hasAnyUser: vi.fn(),
    createUser: vi.fn(),
  },
}));

describe("API /api/setup Unit Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/setup", () => {
    it("should return isInitialized: false when no users exist", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(false);

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isInitialized).toBe(false);
    });

    it("should return isInitialized: true when users already exist", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(true);

      const res = await GET();
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isInitialized).toBe(true);
    });
  });

  describe("POST /api/setup", () => {
    it("should reject creation if users already exist (403)", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(true);

      const req = new Request("http://localhost:3000/api/setup", {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          email: "admin@wpos.com",
          password: "password123",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("Setup already completed");
    });

    it("should validate missing email or password (400)", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(false);

      const req = new Request("http://localhost:3000/api/setup", {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          email: "",
          password: "password123",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("required");
    });

    it("should validate password length (400)", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(false);

      const req = new Request("http://localhost:3000/api/setup", {
        method: "POST",
        body: JSON.stringify({
          name: "Admin",
          email: "admin@wpos.com",
          password: "123",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("at least 6 characters");
    });

    it("should create Super Admin successfully when valid and no users exist", async () => {
      vi.mocked(userService.hasAnyUser).mockResolvedValue(false);
      vi.mocked(userService.createUser).mockResolvedValue({
        id: "u-super",
        name: "Super Admin",
        email: "admin@wpos.com",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        warehouseId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new Request("http://localhost:3000/api/setup", {
        method: "POST",
        body: JSON.stringify({
          name: "Super Admin",
          email: "admin@wpos.com",
          password: "password123",
        }),
      });

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.user.role).toBe("SUPER_ADMIN");
      expect(userService.createUser).toHaveBeenCalledWith({
        name: "Super Admin",
        email: "admin@wpos.com",
        password: "password123",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      });
    });
  });
});
