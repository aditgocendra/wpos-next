import { prisma as defaultPrisma } from "@/lib/prisma";
import type { TransferStatus } from "@/generated/prisma/client";

export interface TransferItemInput {
  productId: string;
  variantId: string;
  quantity: number;
}

export interface CreateTransferInput {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  items: TransferItemInput[];
  notes?: string;
}

export interface UpdateTransferInput {
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  items?: TransferItemInput[];
  notes?: string;
}

export interface GetTransfersParams {
  sourceWarehouseId?: string;
  destinationWarehouseId?: string;
  warehouseId?: string;
  status?: TransferStatus;
  search?: string;
}

export interface StockTransferItemData {
  id: string;
  transferId: string;
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  sku: string;
  quantity: number;
}

export interface StockTransferData {
  id: string;
  transferNumber: string;
  sourceWarehouseId: string;
  sourceWarehouse: { id: string; name: string; code: string | null };
  destinationWarehouseId: string;
  destinationWarehouse: { id: string; name: string; code: string | null };
  status: TransferStatus;
  notes: string | null;
  createdById: string;
  createdBy: { id: string; name: string | null; email: string };
  updatedById: string | null;
  updatedBy: { id: string; name: string | null; email: string } | null;
  items: StockTransferItemData[];
  totalQuantity: number;
  productNames: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class TransferService {
  constructor(private db = defaultPrisma) {}

  /**
   * Helper to generate unique transfer number: TRF-YYYYMMDD-XXXX
   */
  private generateTransferNumber(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomStr = Math.floor(1000 + Math.random() * 9000).toString();
    return `TRF-${dateStr}-${randomStr}`;
  }

  /**
   * Format DB record to StockTransferData
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTransfer(t: any): StockTransferData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: StockTransferItemData[] = (t.items || []).map((item: any) => ({
      id: item.id,
      transferId: item.transferId,
      productId: item.productId,
      productName: item.product?.name || "Produk",
      variantId: item.variantId,
      variantName: item.variant?.variantName || "Default",
      sku: item.variant?.sku || "-",
      quantity: item.quantity,
    }));

    const totalQuantity = items.reduce((sum, it) => sum + it.quantity, 0);
    const productNames = Array.from(new Set(items.map((it) => it.productName)));

    return {
      id: t.id,
      transferNumber: t.transferNumber,
      sourceWarehouseId: t.sourceWarehouseId,
      sourceWarehouse: t.sourceWarehouse,
      destinationWarehouseId: t.destinationWarehouseId,
      destinationWarehouse: t.destinationWarehouse,
      status: t.status,
      notes: t.notes,
      createdById: t.createdById,
      createdBy: t.createdBy,
      updatedById: t.updatedById,
      updatedBy: t.updatedBy,
      items,
      totalQuantity,
      productNames,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  /**
   * Create a draft transfer order
   */
  async createTransferOrder(
    input: CreateTransferInput,
    createdById: string
  ): Promise<StockTransferData> {
    const { sourceWarehouseId, destinationWarehouseId, items, notes } = input;

    if (!sourceWarehouseId || !destinationWarehouseId) {
      throw new Error("Gudang asal dan gudang tujuan wajib dipilih");
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error("Gudang asal dan gudang tujuan tidak boleh sama");
    }

    if (!items || items.length === 0) {
      throw new Error("Daftar barang transfer tidak boleh kosong");
    }

    // Verify warehouses exist
    const [sourceWarehouse, destinationWarehouse] = await Promise.all([
      this.db.warehouse.findUnique({ where: { id: sourceWarehouseId } }),
      this.db.warehouse.findUnique({ where: { id: destinationWarehouseId } }),
    ]);

    if (!sourceWarehouse) {
      throw new Error("Gudang asal tidak ditemukan");
    }

    if (!destinationWarehouse) {
      throw new Error("Gudang tujuan tidak ditemukan");
    }

    // Validate items and verify available stock in source warehouse
    for (const item of items) {
      if (!item.productId || !item.variantId) {
        throw new Error("Produk dan varian wajib dipilih untuk setiap item");
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new Error("Kuantitas transfer harus lebih besar dari 0");
      }

      const variant = await this.db.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true, warehouseStocks: { where: { warehouseId: sourceWarehouseId } } },
      });

      if (!variant) {
        throw new Error(`Varian produk dengan ID ${item.variantId} tidak ditemukan`);
      }

      if (variant.productId !== item.productId) {
        throw new Error(`Varian "${variant.variantName}" tidak cocok dengan produk yang dipilih`);
      }

      const sourceStockRecord = variant.warehouseStocks[0];
      const sourceStock = sourceStockRecord ? sourceStockRecord.stock : 0;

      if (sourceStock < item.quantity) {
        throw new Error(`Stok varian "${variant.variantName}" di gudang asal tidak mencukupi (Tersedia: ${sourceStock}, Diminta: ${item.quantity})`);
      }
    }

    const transferNumber = this.generateTransferNumber();

    const transfer = await this.db.stockTransfer.create({
      data: {
        transferNumber,
        sourceWarehouseId,
        destinationWarehouseId,
        status: "PENDING",
        notes: notes?.trim() || null,
        createdById,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
          })),
        },
      },
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, variantName: true, sku: true } },
          },
        },
      },
    });

    return this.formatTransfer(transfer);
  }

  /**
   * CRITICAL LOGIC: Execute atomic stock transfer
   * Wrapped in prisma.$transaction([])
   */
  async executeTransfer(
    transferId: string,
    userId: string
  ): Promise<StockTransferData> {
    return await this.db.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: transferId },
        include: {
          sourceWarehouse: true,
          destinationWarehouse: true,
          items: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      });

      if (!transfer) {
        throw new Error("Transfer stok tidak ditemukan");
      }

      // 1. Business Rule: Status must be PENDING or IN_TRANSIT
      if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
        throw new Error(
          `Transfer tidak dapat dieksekusi karena status saat ini: ${transfer.status}`
        );
      }

      // 2. Business Rule: Validate stock availability and mutate stock atomically
      for (const item of transfer.items) {
        const sourceVariant = await tx.productVariant.findUnique({
          where: { id: item.variantId },
          include: { warehouseStocks: { where: { warehouseId: transfer.sourceWarehouseId } } },
        });

        if (!sourceVariant) {
          throw new Error(`Varian produk tidak ditemukan untuk item transfer ID: ${item.id}`);
        }

        const sourceStockRecord = sourceVariant.warehouseStocks[0];
        const sourceStock = sourceStockRecord ? sourceStockRecord.stock : 0;

        if (sourceStock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK: Stok tidak mencukupi untuk varian asal (Tersedia: ${sourceStock}, Dibutuhkan: ${item.quantity})`);
        }

        // Decrement stock at source warehouse variant stock
        await tx.productVariantStock.update({
          where: { id: sourceStockRecord.id },
          data: { stock: { decrement: item.quantity } },
        });

        // Add stock to destination warehouse variant stock
        await tx.productVariantStock.upsert({
          where: { variantId_warehouseId: { variantId: item.variantId, warehouseId: transfer.destinationWarehouseId } },
          update: { stock: { increment: item.quantity } },
          create: { variantId: item.variantId, warehouseId: transfer.destinationWarehouseId, stock: item.quantity }
        });
      }

      // 4. Update transfer status to TRANSFERED
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "TRANSFERED",
          updatedById: userId,
        },
        include: {
          sourceWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, variantName: true, sku: true } },
            },
          },
        },
      });

      return this.formatTransfer(updatedTransfer);
    });
  }

  /**
   * Cancel/Reject a transfer
   */
  async cancelTransfer(
    transferId: string,
    userId: string,
    reason?: string
  ): Promise<StockTransferData> {
    const transfer = await this.db.stockTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error("Transfer stok tidak ditemukan");
    }

    if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
      throw new Error(
        `Transfer tidak dapat dibatalkan karena status saat ini: ${transfer.status}`
      );
    }

    const updated = await this.db.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: "CANCELLED",
        notes: reason
          ? `${transfer.notes ? transfer.notes + " | " : ""}Alasan penolakan: ${reason}`
          : transfer.notes,
        updatedById: userId,
      },
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, variantName: true, sku: true } },
          },
        },
      },
    });

    return this.formatTransfer(updated);
  }

  /**
   * Update draft transfer
   */
  async updateTransfer(
    transferId: string,
    input: UpdateTransferInput,
    userId: string
  ): Promise<StockTransferData> {
    const existing = await this.db.stockTransfer.findUnique({
      where: { id: transferId },
      include: { items: true },
    });

    if (!existing) {
      throw new Error("Transfer stok tidak ditemukan");
    }

    if (existing.status !== "PENDING") {
      throw new Error("Hanya transfer dengan status PENDING yang dapat diedit");
    }

    const sourceWarehouseId =
      input.sourceWarehouseId || existing.sourceWarehouseId;
    const destinationWarehouseId =
      input.destinationWarehouseId || existing.destinationWarehouseId;

    if (sourceWarehouseId === destinationWarehouseId) {
      throw new Error("Gudang asal dan gudang tujuan tidak boleh sama");
    }

    return await this.db.$transaction(async (tx) => {
      if (input.items && input.items.length > 0) {
        // Validate items
        for (const item of input.items) {
          if (!item.productId || !item.variantId) {
            throw new Error("Produk dan varian wajib dipilih");
          }
          if (!item.quantity || item.quantity <= 0) {
            throw new Error("Kuantitas transfer harus lebih besar dari 0");
          }

          const variant = await tx.productVariant.findUnique({
            where: { id: item.variantId },
            include: { product: true, warehouseStocks: { where: { warehouseId: sourceWarehouseId } } },
          });

          if (!variant) {
            throw new Error(`Varian dengan ID ${item.variantId} tidak ditemukan`);
          }

          const sourceStockRecord = variant.warehouseStocks[0];
          const sourceStock = sourceStockRecord ? sourceStockRecord.stock : 0;

          if (sourceStock < item.quantity) {
            throw new Error(`Stok varian "${variant.variantName}" di gudang asal tidak mencukupi (Tersedia: ${sourceStock}, Diminta: ${item.quantity})`);
          }
        }

        // Delete old items and insert new ones
        await tx.stockTransferItem.deleteMany({
          where: { transferId },
        });

        await tx.stockTransferItem.createMany({
          data: input.items.map((it) => ({
            transferId,
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
          })),
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          sourceWarehouseId,
          destinationWarehouseId,
          notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
          updatedById: userId,
        },
        include: {
          sourceWarehouse: { select: { id: true, name: true, code: true } },
          destinationWarehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, variantName: true, sku: true } },
            },
          },
        },
      });

      return this.formatTransfer(updated);
    });
  }

  /**
   * Delete transfer (Super Admin only, allowed for any status including TRANSFERED)
   */
  async deleteTransfer(transferId: string, userRole: string): Promise<boolean> {
    if (userRole !== "SUPER_ADMIN") {
      throw new Error("Akses ditolak: Hanya Super Admin yang dapat menghapus transfer stok");
    }

    const transfer = await this.db.stockTransfer.findUnique({
      where: { id: transferId },
    });

    if (!transfer) {
      throw new Error("Transfer stok tidak ditemukan");
    }

    await this.db.stockTransfer.delete({
      where: { id: transferId },
    });

    return true;
  }

  /**
   * Get all transfers with search, filter, sort
   */
  async getTransfers(params: GetTransfersParams = {}): Promise<StockTransferData[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {};

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.sourceWarehouseId) {
      whereClause.sourceWarehouseId = params.sourceWarehouseId;
    }

    if (params.destinationWarehouseId) {
      whereClause.destinationWarehouseId = params.destinationWarehouseId;
    }

    if (params.warehouseId) {
      whereClause.OR = [
        { sourceWarehouseId: params.warehouseId },
        { destinationWarehouseId: params.warehouseId },
      ];
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      whereClause.OR = [
        ...(whereClause.OR || []),
        { transferNumber: { contains: q, mode: "insensitive" } },
        {
          items: {
            some: {
              OR: [
                { product: { name: { contains: q, mode: "insensitive" } } },
                { variant: { sku: { contains: q, mode: "insensitive" } } },
                { variant: { variantName: { contains: q, mode: "insensitive" } } },
              ],
            },
          },
        },
      ];
    }

    const transfers = await this.db.stockTransfer.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, variantName: true, sku: true } },
          },
        },
      },
    });

    return transfers.map((t) => this.formatTransfer(t));
  }

  /**
   * Get single transfer by ID
   */
  async getTransferById(id: string): Promise<StockTransferData | null> {
    const transfer = await this.db.stockTransfer.findUnique({
      where: { id },
      include: {
        sourceWarehouse: { select: { id: true, name: true, code: true } },
        destinationWarehouse: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: { select: { id: true, variantName: true, sku: true } },
          },
        },
      },
    });

    if (!transfer) return null;
    return this.formatTransfer(transfer);
  }
}

export const transferService = new TransferService();
