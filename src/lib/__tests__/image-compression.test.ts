import { describe, it, expect, vi } from "vitest";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  compressClientImage,
} from "../image-compression";

vi.mock("browser-image-compression", () => {
  return {
    default: vi.fn(async (file: File, options?: { maxSizeMB?: number; fileType?: string }) => {
      // Return a mocked Blob with size depending on test scenario
      const size = options?.maxSizeMB ? Math.floor(options.maxSizeMB * 1024 * 1024) : 400 * 1024;
      return new Blob([new ArrayBuffer(size)], { type: options?.fileType || "image/webp" });
    }),
  };
});

describe("Client Image Compression Helper", () => {
  it("should have valid allowed types and size limit defined", () => {
    expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
    expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
    expect(MAX_FILE_SIZE_BYTES).toBe(512 * 1024);
  });

  it("should throw error if unsupported file type is provided", async () => {
    const fakeFile = new File(["fake content"], "document.pdf", {
      type: "application/pdf",
    });

    await expect(compressClientImage(fakeFile)).rejects.toThrow(
      /Format file tidak didukung/
    );
  });

  it("should successfully compress supported image to WebP", async () => {
    const pngFile = new File(["dummy png"], "photo.png", {
      type: "image/png",
    });

    const compressed = await compressClientImage(pngFile);
    expect(compressed.name).toBe("photo.webp");
    expect(compressed.type).toBe("image/webp");
    expect(compressed.size).toBeLessThanOrEqual(MAX_FILE_SIZE_BYTES);
  });
});
