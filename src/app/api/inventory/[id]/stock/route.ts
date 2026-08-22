import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "SUPER_ADMIN" && session.user.role !== "WAREHOUSE_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin atau Warehouse Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await req.json();
    const { variantId, stock, priceCost } = body;

    if (!variantId) {
      return NextResponse.json(
        { error: "Varian produk wajib dipilih" },
        { status: 400 }
      );
    }

    if (stock === undefined || Number(stock) <= 0) {
      return NextResponse.json(
        { error: "Jumlah stok tambahan harus lebih dari 0" },
        { status: 400 }
      );
    }

    if (priceCost === undefined || Number(priceCost) < 0) {
      return NextResponse.json(
        { error: "Harga modal wajib diisi dan tidak boleh bernilai negatif" },
        { status: 400 }
      );
    }

    const product = await inventoryService.addStock(
      id,
      {
        variantId,
        stock: Number(stock),
        priceCost: Number(priceCost),
      },
      session.user.id
    );

    return NextResponse.json({ product });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("tidak ditemukan") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
