import { describe, it, expect, vi, beforeEach } from "vitest";
import { CategoryService } from "../category.service";

describe("CategoryService Unit Tests", () => {
  let categoryService: CategoryService;
  let mockPrisma: {
    category: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const sampleRootCategory = {
    id: "cat-root",
    name: "Electronic",
    code: "ELC",
    parentId: null,
    parent: null,
    children: [
      { id: "cat-audio", name: "Audio", code: "AUD" },
    ],
    createdAt: new Date("2026-01-01T10:00:00Z"),
    updatedAt: new Date("2026-01-01T10:00:00Z"),
  };

  const sampleChildCategory = {
    id: "cat-audio",
    name: "Audio",
    code: "AUD",
    parentId: "cat-root",
    parent: { id: "cat-root", name: "Electronic", code: "ELC" },
    children: [
      { id: "cat-earphone", name: "Earphone", code: "EAR" },
    ],
    createdAt: new Date("2026-01-01T11:00:00Z"),
    updatedAt: new Date("2026-01-01T11:00:00Z"),
  };

  const sampleGrandchildCategory = {
    id: "cat-earphone",
    name: "Earphone",
    code: "EAR",
    parentId: "cat-audio",
    parent: { id: "cat-audio", name: "Audio", code: "AUD" },
    children: [],
    createdAt: new Date("2026-01-01T12:00:00Z"),
    updatedAt: new Date("2026-01-01T12:00:00Z"),
  };

  beforeEach(() => {
    mockPrisma = {
      category: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
    categoryService = new CategoryService(
      mockPrisma as unknown as ConstructorParameters<typeof CategoryService>[0]
    );
  });

  describe("getAllCategories", () => {
    it("should return categories with proper hierarchy path and level", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        sampleRootCategory,
        sampleChildCategory,
        sampleGrandchildCategory,
      ]);

      const result = await categoryService.getAllCategories();
      expect(result).toHaveLength(3);

      const root = result.find((c) => c.id === "cat-root")!;
      expect(root.fullPath).toBe("Electronic");
      expect(root.level).toBe(0);
      expect(root.childrenCount).toBe(1);

      const child = result.find((c) => c.id === "cat-audio")!;
      expect(child.fullPath).toBe("Electronic > Audio");
      expect(child.level).toBe(1);

      const grandchild = result.find((c) => c.id === "cat-earphone")!;
      expect(grandchild.fullPath).toBe("Electronic > Audio > Earphone");
      expect(grandchild.level).toBe(2);
      expect(grandchild.productsCount).toBe(0);
    });

    it("should map _count.products to productsCount correctly", async () => {
      mockPrisma.category.findMany.mockResolvedValue([
        {
          ...sampleRootCategory,
          _count: { products: 42 },
        },
      ]);

      const result = await categoryService.getAllCategories();
      expect(result[0].productsCount).toBe(42);
    });
  });

  describe("getCategoryById", () => {
    it("should return category detail with calculated full path", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleGrandchildCategory);
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-root", name: "Electronic", code: "ELC", parentId: null },
        { id: "cat-audio", name: "Audio", code: "AUD", parentId: "cat-root" },
        { id: "cat-earphone", name: "Earphone", code: "EAR", parentId: "cat-audio" },
      ]);

      const result = await categoryService.getCategoryById("cat-earphone");
      expect(result).not.toBeNull();
      expect(result?.fullPath).toBe("Electronic > Audio > Earphone");
      expect(result?.level).toBe(2);
      expect(result?.code).toBe("EAR");
      expect(result?.parent?.name).toBe("Audio");
    });

    it("should return null when category is not found", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      const result = await categoryService.getCategoryById("non-existent");
      expect(result).toBeNull();
    });
  });

  describe("createCategory", () => {
    it("should create a root category successfully", async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(null) // code check
        .mockResolvedValueOnce(sampleRootCategory); // getCategoryById call
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-root", name: "Electronic", code: "ELC", parentId: null },
      ]);
      mockPrisma.category.create.mockResolvedValue(sampleRootCategory);

      const result = await categoryService.createCategory({
        name: "Electronic",
        code: "elc",
      });

      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: {
          name: "Electronic",
          code: "ELC",
          parentId: null,
        },
        include: expect.any(Object),
      });
      expect(result.code).toBe("ELC");
    });

    it("should create a subcategory with parentId", async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(null) // code uniqueness check
        .mockResolvedValueOnce(sampleRootCategory) // parent existence check
        .mockResolvedValueOnce(sampleChildCategory); // getCategoryById call
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-root", name: "Electronic", code: "ELC", parentId: null },
        { id: "cat-audio", name: "Audio", code: "AUD", parentId: "cat-root" },
      ]);
      mockPrisma.category.create.mockResolvedValue(sampleChildCategory);

      const result = await categoryService.createCategory({
        name: "Audio",
        code: "AUD",
        parentId: "cat-root",
      });

      expect(mockPrisma.category.create).toHaveBeenCalledWith({
        data: {
          name: "Audio",
          code: "AUD",
          parentId: "cat-root",
        },
        include: expect.any(Object),
      });
      expect(result.code).toBe("AUD");
    });

    it("should throw error if code is not 3 characters", async () => {
      await expect(
        categoryService.createCategory({
          name: "Audio",
          code: "AU",
        })
      ).rejects.toThrow("Kode kategori harus tepat 3 karakter");

      await expect(
        categoryService.createCategory({
          name: "Audio",
          code: "AUDIO",
        })
      ).rejects.toThrow("Kode kategori harus tepat 3 karakter");
    });

    it("should throw error if code already exists", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleRootCategory);

      await expect(
        categoryService.createCategory({
          name: "Duplicate",
          code: "ELC",
        })
      ).rejects.toThrow('Kode kategori "ELC" sudah digunakan');
    });

    it("should throw error if name is empty", async () => {
      await expect(
        categoryService.createCategory({
          name: "   ",
          code: "ELC",
        })
      ).rejects.toThrow("Nama kategori wajib diisi");
    });

    it("should throw error if parent does not exist", async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(null) // code uniqueness
        .mockResolvedValueOnce(null); // parent check

      await expect(
        categoryService.createCategory({
          name: "Child",
          code: "CHD",
          parentId: "non-existent-parent",
        })
      ).rejects.toThrow("Parent kategori tidak ditemukan");
    });
  });

  describe("updateCategory", () => {
    it("should update category successfully", async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(sampleRootCategory) // existing check
        .mockResolvedValueOnce({
          ...sampleRootCategory,
          name: "Electronics Updated",
        }); // getCategoryById
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-root", name: "Electronics Updated", code: "ELC", parentId: null },
      ]);
      mockPrisma.category.update.mockResolvedValue({});

      const result = await categoryService.updateCategory("cat-root", {
        name: "Electronics Updated",
      });

      expect(mockPrisma.category.update).toHaveBeenCalledWith({
        where: { id: "cat-root" },
        data: { name: "Electronics Updated" },
      });
      expect(result.name).toBe("Electronics Updated");
    });

    it("should prevent setting category as its own parent", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleRootCategory);

      await expect(
        categoryService.updateCategory("cat-root", {
          parentId: "cat-root",
        })
      ).rejects.toThrow("Kategori tidak dapat menjadi parent untuk dirinya sendiri");
    });

    it("should prevent circular dependency (selecting a descendant as parent)", async () => {
      mockPrisma.category.findUnique
        .mockResolvedValueOnce(sampleRootCategory) // existing check
        .mockResolvedValueOnce(sampleGrandchildCategory); // parent check for cat-earphone
      mockPrisma.category.findMany.mockResolvedValue([
        { id: "cat-root", parentId: null },
        { id: "cat-audio", parentId: "cat-root" },
        { id: "cat-earphone", parentId: "cat-audio" },
      ]);

      await expect(
        categoryService.updateCategory("cat-root", {
          parentId: "cat-earphone",
        })
      ).rejects.toThrow("mencegah relasi melingkar");
    });

    it("should throw error if updating non-existent category", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        categoryService.updateCategory("non-existent", { name: "New Name" })
      ).rejects.toThrow("Kategori tidak ditemukan");
    });
  });

  describe("deleteCategory", () => {
    it("should delete category successfully", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(sampleRootCategory);
      mockPrisma.category.delete.mockResolvedValue(sampleRootCategory);

      const result = await categoryService.deleteCategory("cat-root");
      expect(mockPrisma.category.delete).toHaveBeenCalledWith({
        where: { id: "cat-root" },
      });
      expect(result).toEqual({ success: true });
    });

    it("should throw error if deleting non-existent category", async () => {
      mockPrisma.category.findUnique.mockResolvedValue(null);

      await expect(
        categoryService.deleteCategory("non-existent")
      ).rejects.toThrow("Kategori tidak ditemukan");
    });
  });
});
