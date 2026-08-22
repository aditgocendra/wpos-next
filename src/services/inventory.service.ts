import { prisma as defaultPrisma } from "@/lib/prisma";

export interface ProductVariantItem {
  id: string;
  productId: string;
  variantName: string;
  sku: string;
  stock: number;
  priceSell: number;
  priceCost: number;
  createdById: string;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductItem {
  id: string;
  name: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    code: string;
  };
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string | null;
  };
  totalStock: number;
  avgCostPrice: number;
  variants: ProductVariantItem[];
  createdById: string;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
  updatedById: string | null;
  updatedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateVariantInput {
  variantName: string;
  sku: string;
  stock: number;
  priceSell: number;
  priceCost: number;
}

export interface CreateProductInput {
  name: string;
  categoryId: string;
  warehouseId: string;
  variants: CreateVariantInput[];
}

export interface UpdateVariantInput {
  id?: string; // If provided, update existing; if not, create new
  variantName: string;
  sku: string;
  stock: number;
  priceSell: number;
  priceCost: number;
}

export interface UpdateProductInput {
  name?: string;
  categoryId?: string;
  warehouseId?: string;
  variants?: UpdateVariantInput[];
}

export interface AddStockInput {
  variantId: string;
  stock: number;
  priceCost: number;
}

export interface GetProductsParams {
  warehouseId?: string;
  categoryId?: string;
  search?: string;
}

export class InventoryService {
  constructor(private db = defaultPrisma) {}

  /**
   * Validate SKU format: CODE1-CODE2-CODE3-CODE4
   * e.g., EAR-SON-WF1-BLK
   */
  public validateSku(sku: string): string {
    const formatted = sku.trim().toUpperCase();
    if (!formatted) {
      throw new Error("SKU wajib diisi untuk setiap varian");
    }

    const segments = formatted.split("-");
    if (segments.length < 3) {
      throw new Error(
        `Format SKU "${formatted}" tidak valid. Format standar minimal 3-4 segmen: CODE1(Kat)-CODE2(Brand)-CODE3(Prod)-CODE4(Varian) (contoh: EAR-SON-WF1-BLK)`
      );
    }

    // Check each segment contains only letters/numbers
    for (const seg of segments) {
      if (!seg || !/^[A-Z0-9]+$/.test(seg)) {
        throw new Error(
          `Segmen SKU "${seg}" pada "${formatted}" tidak valid. Hanya boleh mengandung huruf atau angka`
        );
      }
    }

    return formatted;
  }

  /**
   * Calculate moving average HPP and total stock from variants
   */
  public calculateStockAndAvgCost(
    variants: { stock: number; priceCost: number }[]
  ): { totalStock: number; avgCostPrice: number } {
    if (!variants || variants.length === 0) {
      return { totalStock: 0, avgCostPrice: 0 };
    }

    const totalStock = variants.reduce((sum, v) => sum + Math.max(0, Number(v.stock) || 0), 0);

    if (totalStock > 0) {
      const totalCost = variants.reduce(
        (sum, v) => sum + Math.max(0, Number(v.stock) || 0) * (Number(v.priceCost) || 0),
        0
      );
      const avgCostPrice = Math.round((totalCost / totalStock) * 100) / 100;
      return { totalStock, avgCostPrice };
    }

    // If total stock is 0, average the variant base cost
    const avgCostPrice =
      Math.round(
        (variants.reduce((sum, v) => sum + (Number(v.priceCost) || 0), 0) / variants.length) * 100
      ) / 100;

    return { totalStock: 0, avgCostPrice };
  }

  async getProducts(params: GetProductsParams = {}): Promise<ProductItem[]> {
    const whereClause: {
      warehouseId?: string;
      categoryId?: string;
      OR?: {
        name?: { contains: string; mode: "insensitive" };
        variants?: { some: { sku: { contains: string; mode: "insensitive" } } };
      }[];
    } = {};

    if (params.warehouseId) {
      whereClause.warehouseId = params.warehouseId;
    }

    if (params.categoryId) {
      whereClause.categoryId = params.categoryId;
    }

    if (params.search && params.search.trim()) {
      const query = params.search.trim();
      whereClause.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { variants: { some: { sku: { contains: query, mode: "insensitive" } } } },
      ];
    }

    const products = await this.db.product.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        category: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        variants: {
          orderBy: { createdAt: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return products.map((p) => ({
      id: p.id,
      name: p.name,
      categoryId: p.categoryId,
      category: p.category,
      warehouseId: p.warehouseId,
      warehouse: p.warehouse,
      totalStock: p.totalStock,
      avgCostPrice: p.avgCostPrice,
      variants: p.variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        variantName: v.variantName,
        sku: v.sku,
        stock: v.stock,
        priceSell: v.priceSell,
        priceCost: v.priceCost,
        createdById: v.createdById,
        updatedById: v.updatedById,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      createdById: p.createdById,
      createdBy: p.createdBy,
      updatedById: p.updatedById,
      updatedBy: p.updatedBy,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  async getProductById(id: string): Promise<ProductItem | null> {
    const product = await this.db.product.findUnique({
      where: { id },
      include: {
        category: {
          select: { id: true, name: true, code: true },
        },
        warehouse: {
          select: { id: true, name: true, code: true },
        },
        variants: {
          orderBy: { createdAt: "asc" },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!product) return null;

    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      category: product.category,
      warehouseId: product.warehouseId,
      warehouse: product.warehouse,
      totalStock: product.totalStock,
      avgCostPrice: product.avgCostPrice,
      variants: product.variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        variantName: v.variantName,
        sku: v.sku,
        stock: v.stock,
        priceSell: v.priceSell,
        priceCost: v.priceCost,
        createdById: v.createdById,
        updatedById: v.updatedById,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      })),
      createdById: product.createdById,
      createdBy: product.createdBy,
      updatedById: product.updatedById,
      updatedBy: product.updatedBy,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async createProduct(
    input: CreateProductInput,
    userId: string
  ): Promise<ProductItem> {
    const name = input.name ? input.name.trim() : "";
    if (!name) {
      throw new Error("Nama produk wajib diisi");
    }

    if (!input.categoryId) {
      throw new Error("Kategori produk wajib dipilih");
    }

    if (!input.warehouseId) {
      throw new Error("Gudang produk wajib dipilih");
    }

    if (!input.variants || input.variants.length === 0) {
      throw new Error("1 produk wajib memiliki minimal 1 SKU / varian produk");
    }

    // Verify category exists and is a leaf category (has no children)
    const category = await this.db.category.findUnique({
      where: { id: input.categoryId },
      include: { children: true },
    });
    if (!category) {
      throw new Error("Kategori tidak ditemukan");
    }
    if (category.children && category.children.length > 0) {
      throw new Error(
        `Kategori "${category.name}" memiliki subkategori. Produk wajib menggunakan subkategori paling spesifik (subkategori terdalam/terakhir)`
      );
    }

    // Verify warehouse exists
    const warehouse = await this.db.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throw new Error("Gudang tidak ditemukan");
    }

    // Validate each variant and check SKU uniqueness in batch
    const sanitizedVariants = input.variants.map((v, index) => {
      const variantName = v.variantName?.trim() || `Varian ${index + 1}`;
      const sku = this.validateSku(v.sku);
      const stock = Math.max(0, Math.floor(Number(v.stock) || 0));
      const priceSell = Math.max(0, Number(v.priceSell) || 0);
      const priceCost = Math.max(0, Number(v.priceCost) || 0);

      return {
        variantName,
        sku,
        stock,
        priceSell,
        priceCost,
      };
    });

    // Check duplicate SKUs within input list
    const skuSet = new Set<string>();
    for (const v of sanitizedVariants) {
      if (skuSet.has(v.sku)) {
        throw new Error(`SKU duplikat dalam input formulir: "${v.sku}"`);
      }
      skuSet.add(v.sku);
    }

    // Check existing SKU in database
    const existingSkus = await this.db.productVariant.findMany({
      where: { sku: { in: Array.from(skuSet) } },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      throw new Error(`SKU "${existingSkus[0].sku}" sudah digunakan pada produk lain`);
    }

    const { totalStock, avgCostPrice } = this.calculateStockAndAvgCost(sanitizedVariants);

    // Create product and variants atomically using transaction
    const createdProduct = await this.db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          categoryId: input.categoryId,
          warehouseId: input.warehouseId,
          totalStock,
          avgCostPrice,
          createdById: userId,
          variants: {
            create: sanitizedVariants.map((v) => ({
              variantName: v.variantName,
              sku: v.sku,
              stock: v.stock,
              priceSell: v.priceSell,
              priceCost: v.priceCost,
              createdById: userId,
            })),
          },
        },
      });

      return product;
    });

    const item = await this.getProductById(createdProduct.id);
    if (!item) {
      throw new Error("Gagal mengambil data produk setelah dibuat");
    }
    return item;
  }

  async updateProduct(
    id: string,
    input: UpdateProductInput,
    userId: string
  ): Promise<ProductItem> {
    const existing = await this.db.product.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!existing) {
      throw new Error("Produk tidak ditemukan");
    }

    const updateProductData: {
      name?: string;
      categoryId?: string;
      warehouseId?: string;
      totalStock?: number;
      avgCostPrice?: number;
      updatedById?: string;
    } = {
      updatedById: userId,
    };

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new Error("Nama produk tidak boleh kosong");
      }
      updateProductData.name = name;
    }

    if (input.categoryId !== undefined) {
      const category = await this.db.category.findUnique({
        where: { id: input.categoryId },
        include: { children: true },
      });
      if (!category) {
        throw new Error("Kategori tidak ditemukan");
      }
      if (category.children && category.children.length > 0) {
        throw new Error(
          `Kategori "${category.name}" memiliki subkategori. Produk wajib menggunakan subkategori paling spesifik (subkategori terdalam/terakhir)`
        );
      }
      updateProductData.categoryId = input.categoryId;
    }

    if (input.warehouseId !== undefined) {
      const warehouse = await this.db.warehouse.findUnique({
        where: { id: input.warehouseId },
      });
      if (!warehouse) {
        throw new Error("Gudang tidak ditemukan");
      }
      updateProductData.warehouseId = input.warehouseId;
    }

    // If variants are supplied, validate and sync
    if (input.variants !== undefined) {
      if (input.variants.length === 0) {
        throw new Error("1 produk wajib memiliki minimal 1 SKU / varian produk");
      }

      const sanitizedVariants = input.variants.map((v, index) => {
        const variantName = v.variantName?.trim() || `Varian ${index + 1}`;
        const sku = this.validateSku(v.sku);
        const stock = Math.max(0, Math.floor(Number(v.stock) || 0));
        const priceSell = Math.max(0, Number(v.priceSell) || 0);
        const priceCost = Math.max(0, Number(v.priceCost) || 0);

        return {
          id: v.id,
          variantName,
          sku,
          stock,
          priceSell,
          priceCost,
        };
      });

      // Check duplicates in input
      const skuSet = new Set<string>();
      for (const v of sanitizedVariants) {
        if (skuSet.has(v.sku)) {
          throw new Error(`SKU duplikat dalam input formulir: "${v.sku}"`);
        }
        skuSet.add(v.sku);
      }

      // Check duplicate SKUs in DB belonging to other products
      const existingVariantsInDb = await this.db.productVariant.findMany({
        where: {
          sku: { in: Array.from(skuSet) },
          productId: { not: id },
        },
        select: { sku: true },
      });

      if (existingVariantsInDb.length > 0) {
        throw new Error(
          `SKU "${existingVariantsInDb[0].sku}" sudah digunakan pada produk lain`
        );
      }

      const { totalStock, avgCostPrice } = this.calculateStockAndAvgCost(sanitizedVariants);
      updateProductData.totalStock = totalStock;
      updateProductData.avgCostPrice = avgCostPrice;

      const inputVariantIds = sanitizedVariants
        .map((v) => v.id)
        .filter((vid): vid is string => Boolean(vid));

      // Execute transaction for atomic variant sync
      await this.db.$transaction(async (tx) => {
        // Delete removed variants
        await tx.productVariant.deleteMany({
          where: {
            productId: id,
            id: { notIn: inputVariantIds },
          },
        });

        // Update existing or create new variants
        for (const v of sanitizedVariants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                variantName: v.variantName,
                sku: v.sku,
                stock: v.stock,
                priceSell: v.priceSell,
                priceCost: v.priceCost,
                updatedById: userId,
              },
            });
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                variantName: v.variantName,
                sku: v.sku,
                stock: v.stock,
                priceSell: v.priceSell,
                priceCost: v.priceCost,
                createdById: userId,
              },
            });
          }
        }

        // Update product header
        await tx.product.update({
          where: { id },
          data: updateProductData,
        });
      });
    } else {
      // Just update product fields without touching variants
      await this.db.product.update({
        where: { id },
        data: updateProductData,
      });
    }

    const updated = await this.getProductById(id);
    if (!updated) {
      throw new Error("Gagal mengambil data produk setelah diperbarui");
    }
    return updated;
  }

  async addStock(
    productId: string,
    input: AddStockInput,
    userId: string
  ): Promise<ProductItem> {
    const addedStock = Math.floor(Number(input.stock) || 0);
    if (addedStock <= 0) {
      throw new Error("Jumlah stok tambahan harus lebih dari 0");
    }

    const priceCost = Number(input.priceCost);
    if (isNaN(priceCost) || priceCost < 0) {
      throw new Error("Harga modal harus berupa angka valid dan tidak boleh negatif");
    }

    const product = await this.db.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });

    if (!product) {
      throw new Error("Produk tidak ditemukan");
    }

    const targetVariant = product.variants.find((v) => v.id === input.variantId);
    if (!targetVariant) {
      throw new Error("Varian produk tidak ditemukan");
    }

    // Moving Average Calculation according to PRD 4.4:
    // ((Stok Lama * Avg Cost Lama) + (Stok Baru * Harga Beli Baru)) / Total Stok Baru
    const oldProductTotalStock = product.totalStock;
    const oldProductAvgCost = product.avgCostPrice;
    const newProductTotalStock = oldProductTotalStock + addedStock;

    const newProductAvgCostPrice =
      newProductTotalStock > 0
        ? Math.round(
            (((oldProductTotalStock * oldProductAvgCost) + (addedStock * priceCost)) /
              newProductTotalStock) *
              100
          ) / 100
        : priceCost;

    // Moving average for the specific variant
    const oldVariantStock = targetVariant.stock;
    const oldVariantPriceCost = targetVariant.priceCost;
    const newVariantStock = oldVariantStock + addedStock;
    const newVariantPriceCost =
      newVariantStock > 0
        ? Math.round(
            (((oldVariantStock * oldVariantPriceCost) + (addedStock * priceCost)) /
              newVariantStock) *
              100
          ) / 100
        : priceCost;

    await this.db.$transaction(async (tx) => {
      await tx.productVariant.update({
        where: { id: targetVariant.id },
        data: {
          stock: newVariantStock,
          priceCost: newVariantPriceCost,
          updatedById: userId,
        },
      });

      await tx.product.update({
        where: { id: productId },
        data: {
          totalStock: newProductTotalStock,
          avgCostPrice: newProductAvgCostPrice,
          updatedById: userId,
        },
      });
    });

    const updated = await this.getProductById(productId);
    if (!updated) {
      throw new Error("Gagal mengambil data produk setelah menambah stok");
    }
    return updated;
  }

  async deleteProduct(id: string): Promise<{ success: boolean }> {
    const existing = await this.db.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Produk tidak ditemukan");
    }

    // Cascade delete is configured in schema for variants
    await this.db.product.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const inventoryService = new InventoryService();
