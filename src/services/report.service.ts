import { prisma as defaultPrisma } from "@/lib/prisma";

export interface GetProductReportParams {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  warehouseId?: string;
  search?: string;
  sortBy?: "productName" | "quantitySold" | "totalAmount";
  sortOrder?: "asc" | "desc";
}

export interface ProductReportItem {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  categoryName: string;
  warehouseName: string;
  quantitySold: number;
  totalAmount: number;
  lastSaleDate: Date | null;
}

export interface GetTransactionReportParams {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  warehouseId?: string;
  search?: string;
  sortBy?: "productName" | "transactionNumber" | "createdAt" | "totalAmount";
  sortOrder?: "asc" | "desc";
}

export interface TransactionReportItemDetail {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  categoryName: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface TransactionReportItem {
  id: string;
  transactionNumber: string;
  createdAt: Date;
  warehouseId: string;
  warehouseName: string;
  items: TransactionReportItemDetail[];
  totalQuantity: number;
  totalAmount: number;
  productNames: string;
  variantNames: string;
  categories: string;
  cashierName: string | null;
}

export class ReportService {
  constructor(private db = defaultPrisma) {}

  /**
   * Get Product Sales Report
   */
  async getProductReport(params: GetProductReportParams): Promise<ProductReportItem[]> {
    const { startDate, endDate, categoryId, warehouseId, search, sortBy = "productName", sortOrder = "asc" } = params;

    const whereTransaction: Record<string, unknown> = {};

    if (startDate || endDate) {
      whereTransaction.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        (whereTransaction.createdAt as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (whereTransaction.createdAt as Record<string, unknown>).lte = end;
      }
    }

    if (warehouseId && warehouseId !== "all") {
      whereTransaction.warehouseId = warehouseId;
    }

    const whereItem: Record<string, unknown> = {
      transaction: whereTransaction,
    };

    if (categoryId && categoryId !== "all") {
      whereItem.product = {
        categoryId,
      };
    }

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      whereItem.product = {
        ...(whereItem.product as Record<string, unknown> || {}),
        name: {
          contains: searchTerm,
          mode: "insensitive",
        },
      };
    }

    // Fetch matching transaction items with product, variant, category, and warehouse
    const transactionItems = await this.db.transactionItem.findMany({
      where: whereItem,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        variant: true,
        transaction: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Group items by Product + Variant + Warehouse (or Product + Variant)
    const groupedMap = new Map<string, ProductReportItem>();

    for (const item of transactionItems) {
      const key = `${item.productId}_${item.variantId}_${item.transaction.warehouseId}`;
      const existing = groupedMap.get(key);

      if (existing) {
        existing.quantitySold += item.quantity;
        existing.totalAmount += item.totalPrice;
        if (!existing.lastSaleDate || item.transaction.createdAt > existing.lastSaleDate) {
          existing.lastSaleDate = item.transaction.createdAt;
        }
      } else {
        groupedMap.set(key, {
          id: key,
          productId: item.productId,
          productName: item.product.name,
          variantId: item.variantId,
          variantName: item.variant.variantName,
          sku: item.variant.sku,
          categoryName: item.product.category?.name || "Uncategorized",
          warehouseName: item.transaction.warehouse?.name || "Unknown",
          quantitySold: item.quantity,
          totalAmount: item.totalPrice,
          lastSaleDate: item.transaction.createdAt,
        });
      }
    }

    const result = Array.from(groupedMap.values());

    // Sort result
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "productName") {
        comparison = a.productName.localeCompare(b.productName, undefined, { sensitivity: "base" });
        if (comparison === 0) {
          comparison = a.variantName.localeCompare(b.variantName);
        }
      } else if (sortBy === "quantitySold") {
        comparison = a.quantitySold - b.quantitySold;
      } else if (sortBy === "totalAmount") {
        comparison = a.totalAmount - b.totalAmount;
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }

  /**
   * Get Transaction Sales Report
   */
  async getTransactionReport(params: GetTransactionReportParams): Promise<TransactionReportItem[]> {
    const { startDate, endDate, categoryId, warehouseId, search, sortBy = "productName", sortOrder = "asc" } = params;

    const where: Record<string, unknown> = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        (where.createdAt as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = end;
      }
    }

    if (warehouseId && warehouseId !== "all") {
      where.warehouseId = warehouseId;
    }

    if (search && search.trim() !== "") {
      const searchTerm = search.trim();
      where.transactionNumber = {
        contains: searchTerm,
        mode: "insensitive",
      };
    }

    if (categoryId && categoryId !== "all") {
      where.items = {
        some: {
          product: {
            categoryId,
          },
        },
      };
    }

    const transactions = await this.db.transaction.findMany({
      where,
      include: {
        warehouse: true,
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
            variant: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const result: TransactionReportItem[] = transactions.map((t) => {
      const filteredItems = (categoryId && categoryId !== "all")
        ? t.items.filter((item) => item.product.categoryId === categoryId)
        : t.items;

      const details: TransactionReportItemDetail[] = filteredItems.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        variantId: item.variantId,
        variantName: item.variant.variantName,
        sku: item.variant.sku,
        categoryName: item.product.category?.name || "Uncategorized",
        quantity: item.quantity,
        price: item.price,
        totalPrice: item.totalPrice,
      }));

      const totalQuantity = details.reduce((sum, item) => sum + item.quantity, 0);
      const totalAmount = details.reduce((sum, item) => sum + item.totalPrice, 0);
      const productNames = Array.from(new Set(details.map((item) => item.productName))).join(", ");
      const variantNames = Array.from(new Set(details.map((item) => `${item.productName} (${item.variantName})`))).join(", ");
      const categories = Array.from(new Set(details.map((item) => item.categoryName))).join(", ");

      return {
        id: t.id,
        transactionNumber: t.transactionNumber,
        createdAt: t.createdAt,
        warehouseId: t.warehouseId,
        warehouseName: t.warehouse.name,
        items: details,
        totalQuantity,
        totalAmount: totalAmount > 0 ? totalAmount : t.totalAmount,
        productNames: productNames || "-",
        variantNames: variantNames || "-",
        categories: categories || "-",
        cashierName: t.createdBy?.name || t.createdBy?.email || "System",
      };
    });

    // Sort transactions
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "productName") {
        comparison = a.productNames.localeCompare(b.productNames, undefined, { sensitivity: "base" });
      } else if (sortBy === "transactionNumber") {
        comparison = a.transactionNumber.localeCompare(b.transactionNumber);
      } else if (sortBy === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortBy === "totalAmount") {
        comparison = a.totalAmount - b.totalAmount;
      }

      return sortOrder === "desc" ? -comparison : comparison;
    });

    return result;
  }
}

export const reportService = new ReportService();
