import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { shopeeSyncService } from "@/services/shopee-sync.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN", "WAREHOUSE_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { productId, variantId, warehouseId } = body;

    if (!productId && !variantId) {
      return NextResponse.json(
        { error: "productId atau variantId wajib disertakan" },
        { status: 400 }
      );
    }

    // Ambil variant IDs yang ingin disinkronkan
    let targetVariantIds: string[] = [];
    if (variantId) {
      targetVariantIds = [variantId];
    } else if (productId) {
      const variants = await prisma.productVariant.findMany({
        where: { productId },
        select: { id: true },
      });
      targetVariantIds = variants.map((v) => v.id);
    }

    if (targetVariantIds.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada varian produk yang ditemukan" },
        { status: 404 }
      );
    }

    // 1. Cek apakah varian ini sudah terhubung ke Shopee melalui ProductIntegration
    const productIntegrations = await prisma.productIntegration.findMany({
      where: {
        variantId: { in: targetVariantIds },
      },
      include: {
        integration: {
          include: { warehouse: true },
        },
      },
    });

    if (productIntegrations.length === 0) {
      return NextResponse.json(
        {
          error:
            "SKU varian produk ini belum terhubung ke toko Shopee mana pun. Silakan lakukan 'Sync Produk' di menu Integrasi terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    // 2. Cek apakah toko yang terhubung sudah memiliki pemetaan gudang
    const unmapped = productIntegrations.find((pi) => !pi.integration.warehouseId);
    if (unmapped) {
      return NextResponse.json(
        {
          error: `Toko Shopee (Shop ID: ${unmapped.integration.shopId}) belum dipetakan ke gudang. Silakan tentukan gudang untuk toko ini di menu Integrasi.`,
        },
        { status: 400 }
      );
    }

    // 3. Kumpulkan target gudang dari toko yang terhubung
    let targetWarehouseIds = Array.from(
      new Set(
        productIntegrations
          .map((pi) => pi.integration.warehouseId)
          .filter((w): w is string => !!w)
      )
    );

    // Jika pemanggil memfilter gudang tertentu, batasi hanya gudang tersebut jika cocok
    if (warehouseId && warehouseId !== "ALL") {
      targetWarehouseIds = targetWarehouseIds.filter((id) => id === warehouseId);
      if (targetWarehouseIds.length === 0) {
        return NextResponse.json(
          {
            error:
              "Gudang yang dipilih pada filter tidak terhubung ke toko Shopee manapun untuk produk ini.",
          },
          { status: 400 }
        );
      }
    }

    let totalPushed = 0;
    const allErrors: string[] = [];

    for (const whId of targetWarehouseIds) {
      const result = await shopeeSyncService.pushStockUpdateToShopee(
        whId,
        targetVariantIds.map((id) => ({ variantId: id })),
        { allowInactive: true }
      );
      totalPushed += result.pushedCount;
      if (result.errors) {
        allErrors.push(...result.errors);
      }
    }

    if (totalPushed === 0 && allErrors.length > 0) {
      return NextResponse.json(
        {
          error: allErrors.join(". "),
          pushedCount: 0,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      pushedCount: totalPushed,
      warehouseCount: targetWarehouseIds.length,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error) {
    console.error("Error pada sync stock manual:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
