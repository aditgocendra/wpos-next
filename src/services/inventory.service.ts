import { prisma as defaultPrisma } from "@/lib/prisma";

export interface ProductVariantStockItem {
  id: string;
  variantId: string;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string | null;
  };
  stock: number;
}

export interface ProductVariantItem {
  id: string;
  productId: string;
  variantName: string;
  sku: string;
  priceSell: number;
  priceCost: number;
  warehouseStocks?: ProductVariantStockItem[];
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
  warehouseId?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string | null;
  } | null;
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
  stock?: number;
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
  warehouseId: string;
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

    for (const seg of segments) {
      if (!seg || !/^[A-Z0-9]+$/.test(seg)) {
        throw new Error(
          `Segmen SKU "${seg}" pada "${formatted}" tidak valid. Hanya boleh mengandung huruf atau angka`
        );
      }
    }

    return formatted;
  }

  async getProducts(params: GetProductsParams = {}): Promise<ProductItem[]> {
    const whereClause: any = {};

    if (params.warehouseId) {
      whereClause.variants = {
        some: {
          warehouseStocks: {
            some: { warehouseId: params.warehouseId },
          },
        },
      };
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
          include: {
            warehouseStocks: {
              include: {
                warehouse: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return products.map((p: any) => {
      let productTotalStock = 0;
      let totalCostSum = 0;
      
      const mappedVariants = p.variants.map((v: any) => {
        let relevantStocks = v.warehouseStocks || [];
        if (params.warehouseId) {
          relevantStocks = relevantStocks.filter((s: any) => s.warehouseId === params.warehouseId);
        }
        const variantStock = relevantStocks.reduce((sum: number, s: any) => sum + s.stock, 0);
        
        productTotalStock += variantStock;
        totalCostSum += (variantStock * v.priceCost);
        
        return {
          id: v.id,
          productId: v.productId,
          variantName: v.variantName,
          sku: v.sku,
          priceSell: v.priceSell,
          priceCost: v.priceCost,
          warehouseStocks: v.warehouseStocks,
          createdById: v.createdById,
          updatedById: v.updatedById,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt,
        };
      });

      const avgCostPrice = productTotalStock > 0 ? (totalCostSum / productTotalStock) : 0;

      return {
        id: p.id,
        name: p.name,
        categoryId: p.categoryId,
        category: p.category,
        warehouseId: p.warehouseId,
        warehouse: p.warehouse,
        totalStock: productTotalStock,
        avgCostPrice: avgCostPrice,
        variants: mappedVariants,
        createdById: p.createdById,
        createdBy: p.createdBy,
        updatedById: p.updatedById,
        updatedBy: p.updatedBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
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
          include: {
            warehouseStocks: {
              include: {
                warehouse: { select: { id: true, name: true, code: true } },
              },
            },
          },
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

    let productTotalStock = 0;
    let totalCostSum = 0;
    
    const mappedVariants = product.variants.map((v: any) => {
      const variantStock = (v.warehouseStocks || []).reduce((sum: number, s: any) => sum + s.stock, 0);
      productTotalStock += variantStock;
      totalCostSum += (variantStock * v.priceCost);
      
      return {
        id: v.id,
        productId: v.productId,
        variantName: v.variantName,
        sku: v.sku,
        priceSell: v.priceSell,
        priceCost: v.priceCost,
        warehouseStocks: v.warehouseStocks,
        createdById: v.createdById,
        updatedById: v.updatedById,
        createdAt: v.createdAt,
        updatedAt: v.updatedAt,
      };
    });

    const avgCostPrice = productTotalStock > 0 ? (totalCostSum / productTotalStock) : 0;

    return {
      id: product.id,
      name: product.name,
      categoryId: product.categoryId,
      category: product.category,
      warehouseId: product.warehouseId,
      warehouse: product.warehouse,
      totalStock: productTotalStock,
      avgCostPrice: avgCostPrice,
      variants: mappedVariants,
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

    const warehouse = await this.db.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throw new Error("Gudang tidak ditemukan");
    }

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

    const skuSet = new Set<string>();
    for (const v of sanitizedVariants) {
      if (skuSet.has(v.sku)) {
        throw new Error(`SKU duplikat dalam input formulir: "${v.sku}"`);
      }
      skuSet.add(v.sku);
    }

    const existingSkus = await this.db.productVariant.findMany({
      where: {
        sku: { in: Array.from(skuSet) },
      },
      select: { sku: true },
    });

    if (existingSkus.length > 0) {
      throw new Error(`SKU "${existingSkus[0].sku}" sudah digunakan pada produk lain`);
    }

    const createdProduct = await this.db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name,
          categoryId: input.categoryId,
          warehouseId: input.warehouseId,
          createdById: userId,
          variants: {
            create: sanitizedVariants.map((v) => ({
              variantName: v.variantName,
              sku: v.sku,
              priceSell: v.priceSell,
              priceCost: v.priceCost,
              createdById: userId,
              warehouseStocks: {
                create: {
                  warehouseId: input.warehouseId,
                  stock: v.stock
                }
              }
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
      updateProductData.warehouseId = input.warehouseId;
    }

    if (input.variants !== undefined) {
      if (input.variants.length === 0) {
        throw new Error("1 produk wajib memiliki minimal 1 SKU / varian produk");
      }

      const sanitizedVariants = input.variants.map((v, index) => {
        const variantName = v.variantName?.trim() || `Varian ${index + 1}`;
        const sku = this.validateSku(v.sku);
        const stock = v.stock !== undefined ? Math.max(0, Math.floor(Number(v.stock) || 0)) : undefined;
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

      const skuSet = new Set<string>();
      for (const v of sanitizedVariants) {
        if (skuSet.has(v.sku)) {
          throw new Error(`SKU duplikat dalam input formulir: "${v.sku}"`);
        }
        skuSet.add(v.sku);
      }

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

      const inputVariantIds = sanitizedVariants
        .map((v) => v.id)
        .filter((vid): vid is string => Boolean(vid));

      await this.db.$transaction(async (tx) => {
        await tx.productVariant.deleteMany({
          where: {
            productId: id,
            id: { notIn: inputVariantIds },
          },
        });

        for (const v of sanitizedVariants) {
          if (v.id) {
            await tx.productVariant.update({
              where: { id: v.id },
              data: {
                variantName: v.variantName,
                sku: v.sku,
                priceSell: v.priceSell,
                priceCost: v.priceCost,
                updatedById: userId,
              },
            });
            if (input.warehouseId && v.stock !== undefined) {
              await tx.productVariantStock.upsert({
                where: { variantId_warehouseId: { variantId: v.id, warehouseId: input.warehouseId } },
                update: { stock: v.stock },
                create: { variantId: v.id, warehouseId: input.warehouseId, stock: v.stock }
              });
            }
          } else {
            await tx.productVariant.create({
              data: {
                productId: id,
                variantName: v.variantName,
                sku: v.sku,
                priceSell: v.priceSell,
                priceCost: v.priceCost,
                createdById: userId,
                warehouseStocks: input.warehouseId && v.stock !== undefined ? {
                  create: { warehouseId: input.warehouseId, stock: v.stock }
                } : undefined
              },
            });
          }
        }

        await tx.product.update({
          where: { id },
          data: updateProductData,
        });
      });
    } else {
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

    const targetVariant = await this.db.productVariant.findUnique({
      where: { id: input.variantId },
      include: { warehouseStocks: { where: { warehouseId: input.warehouseId } } }
    });

    if (!targetVariant) {
      throw new Error("Varian produk tidak ditemukan");
    }

    const variantStockRecord = targetVariant.warehouseStocks[0];
    const oldVariantStock = variantStockRecord ? variantStockRecord.stock : 0;
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
          priceCost: newVariantPriceCost,
          updatedById: userId,
        },
      });

      await tx.productVariantStock.upsert({
        where: { variantId_warehouseId: { variantId: targetVariant.id, warehouseId: input.warehouseId } },
        update: { stock: newVariantStock },
        create: { variantId: targetVariant.id, warehouseId: input.warehouseId, stock: newVariantStock }
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
      include: {
        transactionItems: { take: 1 },
        transferItems: { take: 1 },
      }
    });

    if (!existing) {
      throw new Error("Produk tidak ditemukan");
    }

    if (existing.transactionItems.length > 0) {
      throw new Error("Gagal Menghapus: Produk ini sudah memiliki riwayat transaksi penjualan. Sistem melarang penghapusan untuk menjaga integritas data laporan keuangan.");
    }

    if (existing.transferItems.length > 0) {
      throw new Error("Gagal Menghapus: Produk ini sudah pernah dimutasi (Stock Transfer). Sistem melarang penghapusan untuk menjaga integritas riwayat pergerakan barang.");
    }

    await this.db.product.delete({
      where: { id },
    });

    return { success: true };
  }
}

export const inventoryService = new InventoryService();
