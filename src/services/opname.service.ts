import { prisma as defaultPrisma } from "@/lib/prisma";
import type { StockOpnameStatus, Role } from "@/generated/prisma/client";

export interface OpnameItemInput {
  productId: string;
  variantId: string;
  systemStock: number;
  actualStock: number;
  notes?: string | null;
}

export interface CreateOpnameInput {
  warehouseId: string;
  notes?: string | null;
  status?: StockOpnameStatus;
  items: OpnameItemInput[];
}

export interface UpdateOpnameInput {
  notes?: string | null;
  status?: StockOpnameStatus;
  items?: OpnameItemInput[];
}

export interface GetOpnamesParams {
  warehouseId?: string;
  status?: StockOpnameStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UserContext {
  id: string;
  role: Role | string;
  warehouseId?: string | null;
}

export class OpnameService {
  private db: typeof defaultPrisma;

  constructor(customPrisma?: typeof defaultPrisma) {
    this.db = customPrisma || defaultPrisma;
  }

  /**
   * Helper to generate unique opname number: OP-{WH_CODE}-{YYYYMMDD}-{RANDOM/SEQUENCE}
   */
  private async generateOpnameNumber(warehouseId: string): Promise<string> {
    const warehouse = await this.db.warehouse.findUnique({
      where: { id: warehouseId },
      select: { code: true, name: true },
    });

    const whCode = (warehouse?.code || warehouse?.name?.slice(0, 3) || "WH")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    const now = new Date();
    const dateStr = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("");

    const countToday = await this.db.stockOpname.count({
      where: {
        warehouseId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        },
      },
    });

    const seq = String(countToday + 1).padStart(3, "0");
    return `OP-${whCode}-${dateStr}-${seq}`;
  }

  /**
   * Get list of stock opnames with RBAC, filters, search, and pagination.
   */
  async getOpnames(params: GetOpnamesParams, user: UserContext) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const skip = (page - 1) * limit;

    // RBAC: If WAREHOUSE_ADMIN, lock to assigned warehouse
    const targetWarehouseId =
      user.role === "WAREHOUSE_ADMIN" ? user.warehouseId || "NO_WAREHOUSE" : params.warehouseId;

    const where: any = {};

    if (targetWarehouseId) {
      where.warehouseId = targetWarehouseId;
    }

    if (params.status) {
      where.status = params.status;
    }

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { opnameNumber: { contains: q, mode: "insensitive" } },
        { notes: { contains: q, mode: "insensitive" } },
        { warehouse: { name: { contains: q, mode: "insensitive" } } },
      ];
    }

    const [total, data] = await Promise.all([
      this.db.stockOpname.count({ where }),
      this.db.stockOpname.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          warehouse: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, name: true, email: true } },
          updatedBy: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get stock opname detail by ID with items and products.
   */
  async getOpnameById(id: string, user: UserContext) {
    const opname = await this.db.stockOpname.findUnique({
      where: { id },
      include: {
        warehouse: { select: { id: true, name: true, code: true, address: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true } },
            variant: {
              select: {
                id: true,
                variantName: true,
                sku: true,
                priceCost: true,
                priceSell: true,
                images: { select: { image: true }, take: 1 },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!opname) {
      throw new Error("Stock opname tidak ditemukan");
    }

    // RBAC: WAREHOUSE_ADMIN can only view their assigned warehouse
    if (user.role === "WAREHOUSE_ADMIN" && opname.warehouseId !== user.warehouseId) {
      throw new Error("Forbidden: Anda tidak memiliki akses ke stock opname gudang ini");
    }

    return opname;
  }

  /**
   * Create a new stock opname (DRAFT or COMPLETED).
   */
  async createOpname(input: CreateOpnameInput, user: UserContext) {
    if (!input.warehouseId) {
      throw new Error("Gudang wajib dipilih");
    }

    // RBAC: WAREHOUSE_ADMIN cannot choose another warehouse
    if (user.role === "WAREHOUSE_ADMIN" && input.warehouseId !== user.warehouseId) {
      throw new Error("Forbidden: Anda hanya dapat membuat stock opname untuk gudang Anda sendiri");
    }

    if (!input.items || input.items.length === 0) {
      throw new Error("Stock opname wajib memiliki minimal 1 item barang");
    }

    const warehouse = await this.db.warehouse.findUnique({
      where: { id: input.warehouseId },
    });
    if (!warehouse) {
      throw new Error("Gudang tidak ditemukan");
    }

    const opnameNumber = await this.generateOpnameNumber(input.warehouseId);
    const targetStatus: StockOpnameStatus = input.status || "DRAFT";

    return await this.db.$transaction(async (tx) => {
      // 1. Create Stock Opname
      const createdOpname = await tx.stockOpname.create({
        data: {
          opnameNumber,
          warehouseId: input.warehouseId,
          status: targetStatus,
          notes: input.notes?.trim() || null,
          createdById: user.id,
          items: {
            create: input.items.map((item) => {
              const systemStock = Number(item.systemStock) || 0;
              const actualStock = Number(item.actualStock) || 0;
              const difference = actualStock - systemStock;

              return {
                productId: item.productId,
                variantId: item.variantId,
                systemStock,
                actualStock,
                difference,
                notes: item.notes?.trim() || null,
              };
            }),
          },
        },
        include: {
          items: true,
          warehouse: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      // 2. If status is COMPLETED, apply physical stock to ProductVariantStock table immediately
      if (targetStatus === "COMPLETED") {
        for (const item of input.items) {
          await tx.productVariantStock.upsert({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: input.warehouseId,
              },
            },
            create: {
              variantId: item.variantId,
              warehouseId: input.warehouseId,
              stock: Number(item.actualStock) || 0,
            },
            update: {
              stock: Number(item.actualStock) || 0,
            },
          });
        }
      }

      return createdOpname;
    });
  }

  /**
   * Update stock opname (modify items if DRAFT, or mark as COMPLETED / CANCELLED).
   */
  async updateOpname(id: string, input: UpdateOpnameInput, user: UserContext) {
    const existing = await this.db.stockOpname.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existing) {
      throw new Error("Stock opname tidak ditemukan");
    }

    // RBAC: WAREHOUSE_ADMIN can only edit opname of their assigned warehouse
    if (user.role === "WAREHOUSE_ADMIN" && existing.warehouseId !== user.warehouseId) {
      throw new Error("Forbidden: Anda tidak memiliki akses ke stock opname gudang ini");
    }

    if (existing.status === "COMPLETED") {
      throw new Error("Stock opname yang sudah selesai (COMPLETED) tidak dapat diubah lagi");
    }

    if (existing.status === "CANCELLED") {
      throw new Error("Stock opname yang sudah dibatalkan (CANCELLED) tidak dapat diubah lagi");
    }

    const newStatus = input.status || existing.status;

    return await this.db.$transaction(async (tx) => {
      // 1. Update items if provided
      if (input.items && input.items.length > 0) {
        await tx.stockOpnameItem.deleteMany({
          where: { opnameId: id },
        });

        await tx.stockOpnameItem.createMany({
          data: input.items.map((item) => {
            const systemStock = Number(item.systemStock) || 0;
            const actualStock = Number(item.actualStock) || 0;
            const difference = actualStock - systemStock;

            return {
              opnameId: id,
              productId: item.productId,
              variantId: item.variantId,
              systemStock,
              actualStock,
              difference,
              notes: item.notes?.trim() || null,
            };
          }),
        });
      }

      // 2. If status transitions to COMPLETED, synchronize ProductVariantStock
      if (newStatus === "COMPLETED") {
        const finalItems = input.items && input.items.length > 0
          ? input.items
          : existing.items;

        for (const item of finalItems) {
          await tx.productVariantStock.upsert({
            where: {
              variantId_warehouseId: {
                variantId: item.variantId,
                warehouseId: existing.warehouseId,
              },
            },
            create: {
              variantId: item.variantId,
              warehouseId: existing.warehouseId,
              stock: Number(item.actualStock) || 0,
            },
            update: {
              stock: Number(item.actualStock) || 0,
            },
          });
        }
      }

      // 3. Update opname header
      const updated = await tx.stockOpname.update({
        where: { id },
        data: {
          status: newStatus,
          notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
          updatedById: user.id,
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true } },
              variant: { select: { id: true, variantName: true, sku: true } },
            },
          },
          warehouse: true,
          updatedBy: { select: { id: true, name: true, email: true } },
        },
      });

      return updated;
    });
  }

  /**
   * Delete draft stock opname.
   */
  async deleteOpname(id: string, user: UserContext) {
    const existing = await this.db.stockOpname.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Stock opname tidak ditemukan");
    }

    if (user.role === "WAREHOUSE_ADMIN" && existing.warehouseId !== user.warehouseId) {
      throw new Error("Forbidden: Anda tidak memiliki akses ke stock opname gudang ini");
    }

    if (existing.status === "COMPLETED") {
      throw new Error("Stock opname yang sudah selesai (COMPLETED) tidak dapat dihapus");
    }

    return await this.db.stockOpname.delete({
      where: { id },
    });
  }
}

export const opnameService = new OpnameService();
