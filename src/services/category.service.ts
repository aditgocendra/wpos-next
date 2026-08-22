import { prisma as defaultPrisma } from "@/lib/prisma";

export interface CategoryParentInfo {
  id: string;
  name: string;
  code: string;
}

export interface CategoryChildInfo {
  id: string;
  name: string;
  code: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  parent: CategoryParentInfo | null;
  children: CategoryChildInfo[];
  childrenCount: number;
  fullPath: string;
  level: number;
  productsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCategoryInput {
  name: string;
  code: string;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  code?: string;
  parentId?: string | null;
}

export class CategoryService {
  constructor(private db = defaultPrisma) {}

  private validateCode(code: string): string {
    const formatted = code.trim().toUpperCase();
    if (!formatted) {
      throw new Error("Kode kategori wajib diisi");
    }
    if (formatted.length !== 3) {
      throw new Error("Kode kategori harus tepat 3 karakter (contoh: EAR, AUD, CAM)");
    }
    if (!/^[A-Z0-9]{3}$/.test(formatted)) {
      throw new Error("Kode kategori hanya boleh berisi huruf atau angka");
    }
    return formatted;
  }

  private buildHierarchyPaths(categories: {
    id: string;
    name: string;
    code: string;
    parentId: string | null;
  }[]): Map<string, { fullPath: string; level: number }> {
    const categoryMap = new Map(categories.map((c) => [c.id, c]));
    const result = new Map<string, { fullPath: string; level: number }>();

    const getPathAndLevel = (
      id: string,
      visited = new Set<string>()
    ): { fullPath: string; level: number } => {
      if (result.has(id)) {
        return result.get(id)!;
      }

      const cat = categoryMap.get(id);
      if (!cat) {
        return { fullPath: "", level: 0 };
      }

      if (visited.has(id)) {
        // Break circular loop if any corrupted data exists
        return { fullPath: cat.name, level: 0 };
      }

      visited.add(id);

      if (!cat.parentId || !categoryMap.has(cat.parentId)) {
        const info = { fullPath: cat.name, level: 0 };
        result.set(id, info);
        return info;
      }

      const parentInfo = getPathAndLevel(cat.parentId, visited);
      const info = {
        fullPath: parentInfo.fullPath
          ? `${parentInfo.fullPath} > ${cat.name}`
          : cat.name,
        level: parentInfo.level + 1,
      };
      result.set(id, info);
      return info;
    };

    for (const cat of categories) {
      getPathAndLevel(cat.id);
    }

    return result;
  }

  async getAllCategories(): Promise<CategoryItem[]> {
    const categories = await this.db.category.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    const hierarchyMap = this.buildHierarchyPaths(categories);

    return categories.map((cat) => {
      const hierarchy = hierarchyMap.get(cat.id) || {
        fullPath: cat.name,
        level: 0,
      };

      return {
        id: cat.id,
        name: cat.name,
        code: cat.code,
        parentId: cat.parentId,
        parent: cat.parent,
        children: cat.children,
        childrenCount: cat.children.length,
        fullPath: hierarchy.fullPath,
        level: hierarchy.level,
        productsCount: 0, // Placeholder until products/inventory table is linked
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
      };
    });
  }

  async getCategoryById(id: string): Promise<CategoryItem | null> {
    const category = await this.db.category.findUnique({
      where: { id },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
          },
          orderBy: { name: "asc" },
        },
      },
    });

    if (!category) return null;

    // Fetch all categories for accurate path building
    const all = await this.db.category.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        parentId: true,
      },
    });

    const hierarchyMap = this.buildHierarchyPaths(all);
    const hierarchy = hierarchyMap.get(category.id) || {
      fullPath: category.name,
      level: 0,
    };

    return {
      id: category.id,
      name: category.name,
      code: category.code,
      parentId: category.parentId,
      parent: category.parent,
      children: category.children,
      childrenCount: category.children.length,
      fullPath: hierarchy.fullPath,
      level: hierarchy.level,
      productsCount: 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  async createCategory(input: CreateCategoryInput): Promise<CategoryItem> {
    const name = input.name ? input.name.trim() : "";
    if (!name) {
      throw new Error("Nama kategori wajib diisi");
    }

    const code = this.validateCode(input.code);

    const existingCode = await this.db.category.findUnique({
      where: { code },
    });

    if (existingCode) {
      throw new Error(`Kode kategori "${code}" sudah digunakan`);
    }

    let parentId: string | null = null;
    if (input.parentId && input.parentId !== "__none__" && input.parentId.trim() !== "") {
      const parent = await this.db.category.findUnique({
        where: { id: input.parentId },
      });
      if (!parent) {
        throw new Error("Parent kategori tidak ditemukan");
      }
      parentId = parent.id;
    }

    const created = await this.db.category.create({
      data: {
        name,
        code,
        parentId,
      },
      include: {
        parent: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        children: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    const item = await this.getCategoryById(created.id);
    if (!item) {
      throw new Error("Gagal mengambil data kategori setelah dibuat");
    }
    return item;
  }

  async updateCategory(
    id: string,
    input: UpdateCategoryInput
  ): Promise<CategoryItem> {
    const existing = await this.db.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Kategori tidak ditemukan");
    }

    const updateData: {
      name?: string;
      code?: string;
      parentId?: string | null;
    } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new Error("Nama kategori tidak boleh kosong");
      }
      updateData.name = name;
    }

    if (input.code !== undefined) {
      const code = this.validateCode(input.code);
      if (code !== existing.code) {
        const duplicate = await this.db.category.findUnique({
          where: { code },
        });
        if (duplicate && duplicate.id !== id) {
          throw new Error(`Kode kategori "${code}" sudah digunakan`);
        }
      }
      updateData.code = code;
    }

    if (input.parentId !== undefined) {
      const newParentId =
        !input.parentId || input.parentId === "__none__" || input.parentId.trim() === ""
          ? null
          : input.parentId;

      if (newParentId === id) {
        throw new Error("Kategori tidak dapat menjadi parent untuk dirinya sendiri");
      }

      if (newParentId) {
        const parent = await this.db.category.findUnique({
          where: { id: newParentId },
        });
        if (!parent) {
          throw new Error("Parent kategori tidak ditemukan");
        }

        // Circular hierarchy check: ensure newParentId is not a descendant of id
        const allCategories = await this.db.category.findMany({
          select: { id: true, parentId: true },
        });

        // Find all descendants of current category `id`
        const descendantIds = new Set<string>();
        const collectDescendants = (currentId: string) => {
          for (const c of allCategories) {
            if (c.parentId === currentId && !descendantIds.has(c.id)) {
              descendantIds.add(c.id);
              collectDescendants(c.id);
            }
          }
        };
        collectDescendants(id);

        if (descendantIds.has(newParentId)) {
          throw new Error(
            "Tidak dapat memilih subkategori dari kategori ini sebagai parent (mencegah relasi melingkar)"
          );
        }

        updateData.parentId = newParentId;
      } else {
        updateData.parentId = null;
      }
    }

    await this.db.category.update({
      where: { id },
      data: updateData,
    });

    const updated = await this.getCategoryById(id);
    if (!updated) {
      throw new Error("Gagal mengambil data kategori setelah diperbarui");
    }
    return updated;
  }

  async deleteCategory(id: string): Promise<{ success: boolean }> {
    const existing = await this.db.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Kategori tidak ditemukan");
    }

    await this.db.category.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const categoryService = new CategoryService();
