import { prisma as defaultPrisma } from "@/lib/prisma";

export interface TransactionItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateTransactionInput {
  warehouseId: string;
  items: TransactionItemInput[];
  notes?: string;
}

export interface UpdateTransactionInput {
  warehouseId?: string;
  items?: TransactionItemInput[];
  notes?: string;
}

export interface GetTransactionsParams {
  warehouseId?: string;
  search?: string;
  sortBy?: "productName" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface TransactionItemData {
  id: string;
  transactionId: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  quantity: number;
  price: number;
  totalPrice: number;
  costPrice: number;
}

export interface TransactionData {
  id: string;
  transactionNumber: string;
  warehouseId: string;
  warehouse: { id: string; name: string; code: string | null };
  totalAmount: number;
  notes: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  updatedById: string | null;
  updatedBy: { id: string; name: string | null; email: string } | null;
  items: TransactionItemData[];
  totalQuantity: number;
  productNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class TransactionService {
  constructor(private db = defaultPrisma) {}

  /**
   * Helper to generate unique transaction number: TRX-YYYYMMDD-XXXX
   */
  private generateTransactionNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `TRX-${dateStr}-${randomStr}`;
  }

  /**
   * Format DB record to TransactionData
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTransaction(t: any): TransactionData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: TransactionItemData[] = (t.items || []).map((item: any) => ({
      id: item.id,
      transactionId: item.transactionId,
      productId: item.productId,
      productName: item.product?.name || "Produk",
      variantId: item.variantId,
      variantName: item.variant?.variantName || "Default",
      sku: item.variant?.sku || "-",
      quantity: item.quantity,
      price: item.price,
      totalPrice: item.totalPrice,
      costPrice: item.costPrice,
    }));

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
    const productNames = Array.from(new Set(items.map((it) => it.productName)));

    return {
      id: t.id,
      transactionNumber: t.transactionNumber,
      warehouseId: t.warehouseId,
      warehouse: t.warehouse,
      totalAmount: t.totalAmount,
      notes: t.notes,
      createdById: t.createdById,
      createdBy: t.createdBy,
      updatedById: t.updatedById,
      updatedBy: t.updatedBy || null,
      items,
      totalQuantity,
      productNames,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  /**
   * Get all transactions with optional filters and sorting
   */
  async getTransactions(params?: GetTransactionsParams): Promise<TransactionData[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.warehouseId && params.warehouseId !== "ALL") {
      where.warehouseId = params.warehouseId;
    }

    if (params?.search && params.search.trim() !== "") {
      const searchClean = params.search.trim();
      where.OR = [
        {
          transactionNumber: {
            contains: searchClean,
            mode: "insensitive",
          },
        },
        {
          items: {
            some: {
              product: {
                name: {
                  contains: searchClean,
                  mode: "insensitive",
                },
              },
            },
          },
        },
      ];
    }

    const transactions = await this.db.transaction.findMany({
      where,
      orderBy: {
        createdAt: params?.sortOrder === "asc" ? "asc" : "desc",
      },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            variant: {
              select: {
                id: true,
                variantName: true,
                sku: true,
                priceSell: true,
                priceCost: true,
              },
            },
          },
        },
      },
    });

    const formatted = transactions.map((t) => this.formatTransaction(t));

    // Optional sort by product name
    if (params?.sortBy === "productName") {
      const isAsc = params.sortOrder === "asc";
      formatted.sort((a, b) => {
        const nameA = a.productNames.join(", ").toLowerCase();
        const nameB = b.productNames.join(", ").toLowerCase();
        return isAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    }

    return formatted;
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(id: string): Promise<TransactionData | null> {
    const transaction = await this.db.transaction.findUnique({
      where: { id },
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            variant: {
              select: {
                id: true,
                variantName: true,
                sku: true,
                priceSell: true,
                priceCost: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) return null;
    return this.formatTransaction(transaction);
  }

  /**
   * Create a new sales transaction and deduct stock atomically
   */
  async createTransaction(
    input: CreateTransactionInput,
    userId: string
  ): Promise<TransactionData> {
    if (!input.warehouseId) {
      throw new Error("Gudang wajib dipilih");
    }

    if (!input.items || !Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Daftar barang penjualan tidak boleh kosong");
    }

    return await this.db.$transaction(async (tx) => {
      // 1. Verify warehouse exists
      const warehouse = await tx.warehouse.findUnique({
        where: { id: input.warehouseId },
      });
      if (!warehouse) {
        throw new Error("Gudang tidak ditemukan");
      }

      // 2. Validate items & stock
      const preparedItems: {
        productId: string;
        variantId: string;
        quantity: number;
        price: number;
        totalPrice: number;
        costPrice: number;
      }[] = [];

      let totalAmount = 0;

      for (const item of input.items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new Error("Jumlah produk harus lebih besar dari 0");
        }

        const variant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: {
            product: true,
            warehouseStocks: { where: { warehouseId: input.warehouseId } }
          },
        });

        if (!variant) {
          throw new Error(`Varian produk ID ${item.variantId} tidak ditemukan`);
        }

        if (variant.productId !== item.productId) {
          throw new Error(`Varian ${variant.variantName} tidak cocok dengan produk yang dipilih`);
        }

        const stockRecord = variant.warehouseStocks[0];
        const currentStock = stockRecord ? stockRecord.stock : 0;

        if (currentStock < item.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK: Stok tidak mencukupi untuk varian ${variant.variantName} pada produk ${variant.product.name}. (Tersedia: ${currentStock}, Diminta: ${item.quantity})`
          );
        }

        const price = variant.priceSell || 0;
        const costPrice = variant.priceCost || 0; // Removed avgCostPrice fallback since product no longer has it
        const itemTotalPrice = price * item.quantity;

        totalAmount += itemTotalPrice;

        preparedItems.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          price,
          totalPrice: itemTotalPrice,
          costPrice,
        });

        // 3. Atomically decrement stock
        await tx.productVariantStock.update({
          where: { id: stockRecord.id },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });
      }

      // 4. Create Transaction record
      const transactionNumber = this.generateTransactionNumber();

      const created = await tx.transaction.create({
        data: {
          transactionNumber,
          warehouseId: input.warehouseId,
          totalAmount,
          notes: input.notes?.trim() || null,
          createdById: userId,
          items: {
            create: preparedItems.map((it) => ({
              productId: it.productId,
              variantId: it.variantId,
              quantity: it.quantity,
              price: it.price,
              totalPrice: it.totalPrice,
              costPrice: it.costPrice,
            })),
          },
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  variantName: true,
                  sku: true,
                  priceSell: true,
                  priceCost: true,
                },
              },
            },
          },
        },
      });

      return this.formatTransaction(created);
    });
  }

  /**
   * Update transaction details
   */
  async updateTransaction(
    id: string,
    input: UpdateTransactionInput,
    userId: string
  ): Promise<TransactionData> {
    return await this.db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Transaksi tidak ditemukan");
      }

      const targetWarehouseId = input.warehouseId || existing.warehouseId;

      let totalAmount = existing.totalAmount;

      if (input.items && Array.isArray(input.items)) {
        if (input.items.length === 0) {
          throw new Error("Daftar barang penjualan tidak boleh kosong");
        }

        // 1. Rollback previous stock
        for (const prevItem of existing.items) {
          await tx.productVariantStock.upsert({
            where: { variantId_warehouseId: { variantId: prevItem.variantId, warehouseId: existing.warehouseId } },
            update: {
              stock: {
                increment: prevItem.quantity,
              },
            },
            create: {
              variantId: prevItem.variantId,
              warehouseId: existing.warehouseId,
              stock: prevItem.quantity
            }
          });
        }

        // 2. Validate and deduct new stock
        const preparedItems: {
          productId: string;
          variantId: string;
          quantity: number;
          price: number;
          totalPrice: number;
          costPrice: number;
        }[] = [];

        totalAmount = 0;

        for (const item of input.items) {
          if (!item.quantity || item.quantity <= 0) {
            throw new Error("Jumlah produk harus lebih besar dari 0");
          }

          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: {
              product: true,
              warehouseStocks: { where: { warehouseId: targetWarehouseId } }
            },
          });

          if (!variant) {
            throw new Error(`Varian produk ID ${item.variantId} tidak ditemukan`);
          }

          if (variant.productId !== item.productId) {
            throw new Error(
              `Varian ${variant.variantName} tidak cocok dengan produk yang dipilih`
            );
          }

          const stockRecord = variant.warehouseStocks[0];
          const currentStock = stockRecord ? stockRecord.stock : 0;

          if (currentStock < item.quantity) {
            throw new Error(
              `INSUFFICIENT_STOCK: Stok tidak mencukupi untuk varian ${variant.variantName} pada produk ${variant.product.name}. (Tersedia: ${currentStock}, Diminta: ${item.quantity})`
            );
          }

          const price = variant.priceSell || 0;
          const costPrice = variant.priceCost || 0;
          const itemTotalPrice = price * item.quantity;

          totalAmount += itemTotalPrice;

          preparedItems.push({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price,
            totalPrice: itemTotalPrice,
            costPrice,
          });

          await tx.productVariantStock.update({
            where: { id: stockRecord.id },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });
        }

        // Delete old items and insert new items
        await tx.transactionItem.deleteMany({
          where: { transactionId: id },
        });

        await tx.transactionItem.createMany({
          data: preparedItems.map((it) => ({
            transactionId: id,
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            price: it.price,
            totalPrice: it.totalPrice,
            costPrice: it.costPrice,
          })),
        });
      }

      const updated = await tx.transaction.update({
        where: { id },
        data: {
          warehouseId: targetWarehouseId,
          notes: input.notes !== undefined ? (input.notes?.trim() || null) : existing.notes,
          totalAmount,
          updatedById: userId,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          updatedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  variantName: true,
                  sku: true,
                  priceSell: true,
                  priceCost: true,
                },
              },
            },
          },
        },
      });

      return this.formatTransaction(updated);
    });
  }

  /**
   * Delete transaction and restore product stock
   */
  async deleteTransaction(id: string): Promise<{ success: boolean }> {
    return await this.db.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!existing) {
        throw new Error("Transaksi tidak ditemukan");
      }

      // 1. Restore stock
      for (const item of existing.items) {
        await tx.productVariantStock.upsert({
          where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: existing.warehouseId } },
          update: {
            stock: {
              increment: item.quantity,
            },
          },
          create: {
            variantId: item.variantId,
            warehouseId: existing.warehouseId,
            stock: item.quantity
          }
        });
      }

      // 2. Delete transaction (items are cascade deleted)
      await tx.transaction.delete({
        where: { id },
      });

      return { success: true };
    });
  }
}

export const transactionService = new TransactionService();
