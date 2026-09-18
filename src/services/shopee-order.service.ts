import { prisma as defaultPrisma } from "@/lib/prisma";
import { getShopeeClientForIntegration } from "@/lib/shopee/client";

export interface ShopeeOrderItemRow {
  id: string; // Unique row ID (orderSn + sku / index)
  noPesanan: string;
  tanggalPesananDibuat: string;
  statusPesanan: string;
  alasanPembatalan: string;
  namaProduk: string;
  nomorReferensiSku: string;
  jumlah: number;
  pendapatanKotor: number;
  hppPerUnit: number;
  hppTotal: number;
  pendapatanSebelumBiayaLainnya: number;
}

export interface ShopeeOrderSummary {
  totalPendapatanKotor: number;
  totalHpp: number;
  totalBiayaLainnya: number;
  totalPendapatanSetelahHpp: number;
  persentasePendapatanBersih: number;
  jumlahPesanan: number;
  pesananSelesai: number;
  pesananBatal: number;
  biayaLainnya: {
    adCost: number;
    operationalCost: number;
    unexpectedCost: number;
  };
}

export interface GetShopeeOrdersParams {
  integrationId: string;
  month?: string; // "YYYY-MM"
  search?: string;
  sortBy?: "orderStatus" | "orderCreatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number; // 10, 25, 50
  refresh?: boolean;
}

export interface GetShopeeOrdersResponse {
  items: ShopeeOrderItemRow[];
  summary: ShopeeOrderSummary;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

interface RawShopeeItem {
  orderSn: string;
  createTime: number; // unix timestamp in seconds
  orderStatus: string;
  cancelReason: string;
  productName: string;
  sku: string;
  quantity: number;
  grossIncome: number; // If completed: item's share of escrow / income
}

// In-memory cache to ensure instant pagination and sorting without hitting Shopee API limits
interface CacheEntry {
  expiresAt: number;
  items: RawShopeeItem[];
}

const liveOrdersCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

export class ShopeeOrderService {
  constructor(
    private db = defaultPrisma,
    private clientFactory = getShopeeClientForIntegration
  ) {}

  /**
   * Helper to format currency
   */
  formatRupiah(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /**
   * Fetch live orders from Shopee OpenAPI or cache for the selected shop and month
   */
  async fetchLiveOrders(params: GetShopeeOrdersParams): Promise<GetShopeeOrdersResponse> {
    const { integrationId } = params;
    if (!integrationId) {
      throw new Error("integrationId wajib diisi.");
    }

    // Default to current month "YYYY-MM" if not specified
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthStr;

    // Check integration
    const integration = await this.db.integration.findUnique({
      where: { id: integrationId },
      include: { warehouse: true },
    });

    if (!integration) {
      throw new Error(`Integrasi Toko dengan ID ${integrationId} tidak ditemukan.`);
    }

    const cacheKey = `${integrationId}:${month}`;
    const cached = liveOrdersCache.get(cacheKey);

    let rawItems: RawShopeeItem[] = [];

    if (!params.refresh && cached && cached.expiresAt > Date.now()) {
      rawItems = cached.items;
    } else {
      rawItems = await this.pullOrdersFromShopee(integration.id, month);
      // Store in memory cache
      liveOrdersCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        items: rawItems,
      });
    }

    // Lookup HPP (priceCost) from ProductVariant in inventory using SKU
    const uniqueSkus = Array.from(
      new Set(rawItems.map((it) => it.sku.trim()).filter((s) => s.length > 0 && s !== "-"))
    );

    const variants = uniqueSkus.length > 0
      ? await this.db.productVariant.findMany({
          where: { sku: { in: uniqueSkus } },
          select: { sku: true, priceCost: true },
        })
      : [];

    const hppMap = new Map<string, number>();
    for (const v of variants) {
      hppMap.set(v.sku.toLowerCase(), v.priceCost);
    }

    // Fetch monthly expense for this integration and month
    const expense =
      "shopeeMonthlyExpense" in this.db && (this.db as any).shopeeMonthlyExpense
        ? await (this.db as any).shopeeMonthlyExpense.findFirst({
            where: {
              integrationId: integration.id,
              month,
            },
          })
        : null;

    const adCost = expense?.adCost || 0;
    const operationalCost = expense?.operationalCost || 0;
    const unexpectedCost = expense?.unexpectedCost || 0;
    const totalBiayaLainnya = adCost + operationalCost + unexpectedCost;

    // Calculate item rows
    const fullItemRows: ShopeeOrderItemRow[] = rawItems.map((item, index) => {
      const hppPerUnit = hppMap.get(item.sku.toLowerCase()) ?? 0;
      const hppTotal = hppPerUnit * item.quantity;
      const isCompleted = item.orderStatus.toUpperCase() === "COMPLETED";
      // Pendapatan Kotor (Diambil dari penghasilan akhir pada detail pesanan, jika status pesanan tidak sama dengan "Selesai", maka 0)
      const pendapatanKotor = isCompleted ? item.grossIncome : 0;
      const pendapatanSebelumBiayaLainnya = pendapatanKotor - hppTotal;

      const dateObj = new Date(item.createTime * 1000);
      const tanggalPesananDibuat = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleString("id-ID", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }).replace(/\./g, ":")
        : "-";

      return {
        id: `${item.orderSn}-${index}`,
        noPesanan: item.orderSn,
        tanggalPesananDibuat,
        statusPesanan: item.orderStatus,
        alasanPembatalan: item.cancelReason || "-",
        namaProduk: item.productName || "Produk Shopee",
        nomorReferensiSku: item.sku || "-",
        jumlah: item.quantity,
        pendapatanKotor,
        hppPerUnit,
        hppTotal,
        pendapatanSebelumBiayaLainnya,
      };
    });

    // Summary calculation across the ENTIRE month
    let totalPendapatanKotor = 0;
    let totalHpp = 0;

    const uniqueOrders = new Set<string>();
    const completedOrders = new Set<string>();
    const cancelledOrders = new Set<string>();

    for (const item of fullItemRows) {
      uniqueOrders.add(item.noPesanan);
      const statusUpper = item.statusPesanan.toUpperCase();

      if (statusUpper === "COMPLETED") {
        completedOrders.add(item.noPesanan);
        totalPendapatanKotor += item.pendapatanKotor;
        totalHpp += item.hppTotal;
      } else if (
        statusUpper === "CANCELLED" ||
        statusUpper === "IN_CANCEL" ||
        statusUpper === "CANCELED"
      ) {
        cancelledOrders.add(item.noPesanan);
      }
    }

    const totalPendapatanSetelahHpp = totalPendapatanKotor - totalHpp - totalBiayaLainnya;
    const persentasePendapatanBersih =
      totalPendapatanKotor > 0
        ? (totalPendapatanSetelahHpp / totalPendapatanKotor) * 100
        : 0;

    const summary: ShopeeOrderSummary = {
      totalPendapatanKotor,
      totalHpp,
      totalBiayaLainnya,
      totalPendapatanSetelahHpp,
      persentasePendapatanBersih,
      jumlahPesanan: uniqueOrders.size,
      pesananSelesai: completedOrders.size,
      pesananBatal: cancelledOrders.size,
      biayaLainnya: {
        adCost,
        operationalCost,
        unexpectedCost,
      },
    };

    // Filter by search query if any
    let filteredItems = fullItemRows;
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase();
      filteredItems = filteredItems.filter(
        (it) =>
          it.noPesanan.toLowerCase().includes(q) ||
          it.namaProduk.toLowerCase().includes(q) ||
          it.nomorReferensiSku.toLowerCase().includes(q) ||
          it.statusPesanan.toLowerCase().includes(q)
      );
    }

    // Sort items: default sort by status pesanan and tanggal pesanan dibuat
    const sortBy = params.sortBy || "orderStatus";
    const sortOrder = params.sortOrder || "asc";

    filteredItems.sort((a, b) => {
      if (sortBy === "orderStatus") {
        const cmp = a.statusPesanan.localeCompare(b.statusPesanan);
        if (cmp !== 0) return sortOrder === "asc" ? cmp : -cmp;
        // Secondary sort: tanggal pesanan dibuat descending
        return b.tanggalPesananDibuat.localeCompare(a.tanggalPesananDibuat);
      } else if (sortBy === "orderCreatedAt") {
        const cmp = a.tanggalPesananDibuat.localeCompare(b.tanggalPesananDibuat);
        return sortOrder === "asc" ? cmp : -cmp;
      }
      return 0;
    });

    // Pagination
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 10);
    const total = filteredItems.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedItems = filteredItems.slice(startIndex, startIndex + limit);

    return {
      items: paginatedItems,
      summary,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Internal method: Pull orders live from Shopee API with 15-day chunking
   */
  private async pullOrdersFromShopee(integrationId: string, month: string): Promise<RawShopeeItem[]> {
    try {
      const shopeeClient = await this.clientFactory(integrationId);

      // Parse month "YYYY-MM"
      const [yearStr, monthStr] = month.split("-");
      const year = parseInt(yearStr, 10);
      const monthIdx = parseInt(monthStr, 10) - 1; // 0-based

      const startOfMonth = new Date(year, monthIdx, 1, 0, 0, 0);
      // Last day of month
      const endOfMonth = new Date(year, monthIdx + 1, 0, 23, 59, 59);

      const now = new Date();
      const actualEnd = endOfMonth > now ? now : endOfMonth;

      const startSec = Math.floor(startOfMonth.getTime() / 1000);
      const finalTimeTo = Math.floor(actualEnd.getTime() / 1000);
      const endOfMonthSec = Math.floor(endOfMonth.getTime() / 1000);

      // If startSec is in the future
      if (startSec > finalTimeTo) {
        return [];
      }

      // Shopee limits time_to - time_from to 15 days (15 * 86400 = 1,296,000s)
      const MAX_CHUNK_SECONDS = 14 * 86400 + 86399; // 14.99 days
      const chunks: { from: number; to: number }[] = [];

      let chunkStart = startSec;
      while (chunkStart <= finalTimeTo) {
        const chunkTo = Math.min(chunkStart + MAX_CHUNK_SECONDS, finalTimeTo);
        chunks.push({ from: chunkStart, to: chunkTo });
        chunkStart = chunkTo + 1;
      }

      // 1. Fetch order lists for each chunk
      const orderSnSet = new Set<string>();
      const orderStatusMap = new Map<string, string>();

      for (const chunk of chunks) {
        let cursor = "";
        let hasMore = true;

        while (hasMore) {
          try {
            const listRes = await shopeeClient.order.getOrderList({
              time_range_field: "create_time",
              time_from: chunk.from,
              time_to: chunk.to,
              page_size: 100,
              cursor: cursor || undefined,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const resData = (listRes as any)?.response || listRes;
            const orders = resData?.order_list || [];

            for (const ord of orders) {
              if (ord.order_sn) {
                orderSnSet.add(ord.order_sn);
                if (ord.order_status) {
                  orderStatusMap.set(ord.order_sn, ord.order_status);
                }
              }
            }

            hasMore = Boolean(resData?.more);
            cursor = resData?.next_cursor || "";
            if (!cursor) hasMore = false;
          } catch (listErr) {
            console.warn(`[ShopeeOrderService] getOrderList error for chunk ${chunk.from}-${chunk.to}:`, listErr);
            hasMore = false;
          }
        }
      }

      const allOrderSns = Array.from(orderSnSet);
      if (allOrderSns.length === 0) {
        return [];
      }

      // 2. Fetch order details in batches of 50
      const BATCH_SIZE = 50;
      const detailedOrders: RawShopeeItem[] = [];

      for (let i = 0; i < allOrderSns.length; i += BATCH_SIZE) {
        const batch = allOrderSns.slice(i, i + BATCH_SIZE);
        try {
          const detailRes = await shopeeClient.order.getOrderDetail({
            order_sn_list: [batch.join(",")],
            response_optional_fields: "item_list,buyer_cancel_reason,cancel_reason,total_amount",
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const resData = (detailRes as any)?.response || detailRes;
          const orderList = resData?.order_list || [];

          for (const ord of orderList) {
            const orderSn = ord.order_sn;
            const orderStatus = ord.order_status || orderStatusMap.get(orderSn) || "PROCESSED";
            const rawCreateTime = ord.create_time;
            const createTime =
              typeof rawCreateTime === "number"
                ? rawCreateTime
                : !isNaN(new Date(rawCreateTime).getTime())
                ? Math.floor(new Date(rawCreateTime).getTime() / 1000)
                : startSec;

            const cancelReason = ord.cancel_reason || ord.buyer_cancel_reason || "";
            const totalAmount = Number(ord.total_amount) || 0;

            const items = Array.isArray(ord.item_list) ? ord.item_list : [];

            if (items.length === 0) {
              detailedOrders.push({
                orderSn,
                createTime,
                orderStatus,
                cancelReason,
                productName: "Produk Shopee",
                sku: "-",
                quantity: 1,
                grossIncome: totalAmount,
              });
            } else {
              // Calculate total item price sum to prorate escrow/total amount if multi-item
              const totalItemsSum = items.reduce(
                (sum: number, it: { model_discounted_price?: number; quantity?: number; model_quantity_purchased?: number }) =>
                  sum + (Number(it.model_discounted_price) || 0) * (Number(it.model_quantity_purchased || it.quantity) || 1),
                0
              );

              for (const it of items) {
                const qty = Number(it.model_quantity_purchased || it.quantity) || 1;
                const itemPrice = Number(it.model_discounted_price || it.model_original_price) || 0;
                const itemTotal = itemPrice * qty;

                // Prorate totalAmount or use itemTotal
                const proratedGrossIncome =
                  totalItemsSum > 0 && totalAmount > 0
                    ? (itemTotal / totalItemsSum) * totalAmount
                    : itemTotal > 0
                    ? itemTotal
                    : totalAmount / items.length;

                detailedOrders.push({
                  orderSn,
                  createTime,
                  orderStatus,
                  cancelReason,
                  productName: it.item_name ? `${it.item_name}${it.model_name ? ` - ${it.model_name}` : ""}` : "Produk Shopee",
                  sku: (it.model_sku || it.item_sku || "-").trim(),
                  quantity: qty,
                  grossIncome: Math.round(proratedGrossIncome),
                });
              }
            }
          }
        } catch (detailErr) {
          console.warn(`[ShopeeOrderService] getOrderDetail error for batch:`, detailErr);
        }
      }

      // Strictly filter orders to ensure they fall within the exact month range
      return detailedOrders.filter(
        (ord) => ord.createTime >= startSec && ord.createTime <= endOfMonthSec
      );
    } catch (err) {
      console.warn("[ShopeeOrderService] pullOrdersFromShopee error:", err);
      return [];
    }
  }

  /**
   * Generates realistic mock orders matching actual inventory SKUs for testing / dev preview
   */
  async generateMockOrdersForMonth(month: string): Promise<RawShopeeItem[]> {
    // Get actual SKUs from DB to ensure realistic HPP calculation
    const variants = await this.db.productVariant.findMany({
      take: 10,
      include: { product: true },
    });

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthIdx = parseInt(monthStr, 10) - 1;

    const items: RawShopeeItem[] = [];

    const statuses = [
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "COMPLETED",
      "READY_TO_SHIP",
      "PROCESSED",
      "SHIPPED",
      "CANCELLED",
      "CANCELLED",
    ];

    const cancelReasons = [
      "Pembeli ingin mengubah alamat pengiriman",
      "Permintaan pembeli",
      "Penjual tidak merespon",
      "Pembeli salah memilih varian",
    ];

    // Create 15-25 mock orders
    const orderCount = 20;
    for (let i = 1; i <= orderCount; i++) {
      const day = Math.min(28, (i * 2) % 28 + 1);
      const date = new Date(year, monthIdx, day, 10 + (i % 8), 15 + (i * 2) % 40);
      const createTime = Math.floor(date.getTime() / 1000);
      const orderSn = `24${monthStr}${day.toString().padStart(2, "0")}${1000 + i * 17}`;
      const status = statuses[i % statuses.length];
      const isCancelled = status === "CANCELLED";
      const cancelReason = isCancelled ? cancelReasons[i % cancelReasons.length] : "";

      const variant = variants.length > 0 ? variants[i % variants.length] : null;
      const sku = variant ? variant.sku : `SKU-ITEM-${100 + i}`;
      const productName = variant
        ? `${variant.product.name} (${variant.variantName})`
        : `Produk Fashion ${i}`;
      const quantity = (i % 3) + 1;
      const sellPrice = variant?.priceSell && variant.priceSell > 0 ? variant.priceSell : 85000 + i * 5000;
      const grossIncome = status === "COMPLETED" ? sellPrice * quantity : 0;

      items.push({
        orderSn,
        createTime,
        orderStatus: status,
        cancelReason,
        productName,
        sku,
        quantity,
        grossIncome,
      });
    }

    return items;
  }

  /**
   * Get Monthly Expense for a specific integration and month
   */
  async getMonthlyExpense(integrationId: string, month: string) {
    if (!("shopeeMonthlyExpense" in this.db) || !(this.db as any).shopeeMonthlyExpense) {
      return null;
    }
    return (this.db as any).shopeeMonthlyExpense.findFirst({
      where: {
        integrationId,
        month,
      },
    });
  }

  /**
   * Upsert Monthly Expense (Biaya Iklan, Biaya Operasional, Biaya Tak Terduga)
   */
  async upsertMonthlyExpense(params: {
    integrationId: string;
    month: string;
    adCost: number;
    operationalCost: number;
    unexpectedCost: number;
    notes?: string;
  }) {
    if (!("shopeeMonthlyExpense" in this.db) || !(this.db as any).shopeeMonthlyExpense) {
      throw new Error("Model shopeeMonthlyExpense belum tersedia di database.");
    }
    const { integrationId, month, adCost, operationalCost, unexpectedCost, notes } = params;

    const existing = await (this.db as any).shopeeMonthlyExpense.findFirst({
      where: {
        integrationId,
        month,
      },
    });

    if (existing) {
      return this.db.shopeeMonthlyExpense.update({
        where: { id: existing.id },
        data: {
          adCost,
          operationalCost,
          unexpectedCost,
          notes,
          updatedAt: new Date(),
        },
      });
    }

    return this.db.shopeeMonthlyExpense.create({
      data: {
        integrationId,
        month,
        adCost,
        operationalCost,
        unexpectedCost,
        notes,
      },
    });
  }
}

export const shopeeOrderService = new ShopeeOrderService();
