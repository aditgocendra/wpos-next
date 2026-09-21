import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ variantId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "SUPER_ADMIN" &&
        session.user.role !== "WAREHOUSE_ADMIN")
    ) {
      return NextResponse.json(
        {
          error: "Forbidden: Hanya Super Admin dan Warehouse Admin yang bisa mengubah HPP",
        },
        { status: 403 }
      );
    }

    const { variantId } = await params;
    const body = await req.json();
    const { priceCost, warehouseId } = body;

    if (priceCost === undefined || priceCost === null || isNaN(Number(priceCost))) {
      return NextResponse.json(
        { error: "Harga modal (HPP) wajib diisi dengan angka valid" },
        { status: 400 }
      );
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: "Gudang asal wajib dikirim" },
        { status: 400 }
      );
    }

    const result = await inventoryService.resetVariantCost(
      variantId,
      warehouseId,
      Number(priceCost),
      session.user.id
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("tidak ditemukan") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
