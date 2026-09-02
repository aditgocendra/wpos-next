import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { getServerSession } from "next-auth";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/supabase", () => ({
  BUCKET_NAME: "product-images",
  supabase: {
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({
          data: { publicUrl: "https://mock.supabase.co/storage/v1/object/public/product-images/variants/mock.webp" },
        }),
      }),
    },
  },
}));

vi.mock("sharp", () => {
  return {
    default: vi.fn(() => ({
      rotate: vi.fn().mockReturnThis(),
      resize: vi.fn().mockReturnThis(),
      webp: vi.fn().mockReturnThis(),
      toBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-webp-data")),
    })),
  };
});

describe("API /api/upload Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return 403 if user is not SUPER_ADMIN (e.g. WAREHOUSE_ADMIN)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-2", role: "WAREHOUSE_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Hanya Super Admin");
  });

  it("should return 403 if request is cross-site (sec-fetch-site: cross-site)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        "sec-fetch-site": "cross-site",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("luar website tidak diizinkan");
  });

  it("should return 403 if origin does not match server host", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const formData = new FormData();
    formData.append("file", new File(["test"], "test.png", { type: "image/png" }));

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        host: "localhost:3000",
        origin: "https://evil-external-site.com",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("Origin request tidak sesuai");
  });

  it("should return 400 if no file is uploaded", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const formData = new FormData();

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("tidak ditemukan");
  });

  it("should return 413 if file exceeds 2 MB raw size", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const largeArray = new Uint8Array(2.5 * 1024 * 1024);
    const largeFile = new File([largeArray], "large.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", largeFile);

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(413);
    const json = await res.json();
    expect(json.error).toContain("Maksimal 2 MB");
  });

  it("should return 400 if file format is invalid (e.g. PDF or text)", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const invalidFile = new File(["test doc"], "doc.txt", { type: "text/plain" });

    const formData = new FormData();
    formData.append("file", invalidFile);

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Format file tidak didukung");
  });

  it("should successfully process and return publicUrl for valid image from same origin", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "user-1", role: "SUPER_ADMIN" },
      expires: "2099-01-01",
    } as never);

    const validFile = new File(["test image buffer"], "photo.png", { type: "image/png" });

    const formData = new FormData();
    formData.append("file", validFile);

    const req = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.url).toContain("supabase.co");
    expect(json.fileName).toContain("variants/");
  });
});
