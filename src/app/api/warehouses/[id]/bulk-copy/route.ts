import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { warehouseService } from "@/services/warehouse.service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan masuk terlebih dahulu" },
        { status: 401 }
      );
    }

    const { id: targetWarehouseId } = await params;
    const userRole = session.user.role;

    // RBAC: Only SUPER_ADMIN can perform bulk copy
    if (userRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat menggunakan fitur salin produk antar gudang" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { sourceWarehouseId, copyStockQuantity, variantIds } = body;

    if (!sourceWarehouseId) {
      return NextResponse.json(
        { error: "Gudang sumber (sourceWarehouseId) wajib dipilih" },
        { status: 400 }
      );
    }

    const result = await warehouseService.bulkCopyProducts(targetWarehouseId, {
      sourceWarehouseId,
      copyStockQuantity: Boolean(copyStockQuantity),
      variantIds: Array.isArray(variantIds) ? variantIds : undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menyalin ${result.copiedCount} varian produk. ${
        result.skippedCount > 0 ? `(${result.skippedCount} varian dilewati karena sudah ada).` : ""
      }`.trim(),
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status =
      message.includes("tidak ditemukan")
        ? 404
        : message.includes("wajib") || message.includes("tidak boleh sama")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
