import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "SUPER_ADMIN" &&
        session.user.role !== "WAREHOUSE_ADMIN" &&
        session.user.role !== "CASHIER")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin, Warehouse Admin, atau Cashier access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const warehouseIdParam = searchParams.get("warehouseId") || undefined;
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || undefined;

    // If user is WAREHOUSE_ADMIN and has assigned warehouse, default to their warehouse if not specified
    let warehouseId = warehouseIdParam;
    if (session.user.role === "WAREHOUSE_ADMIN" && session.user.warehouseId) {
      warehouseId = warehouseIdParam || session.user.warehouseId;
    }

    const products = await inventoryService.getProducts({
      warehouseId,
      categoryId,
      search,
    });

    return NextResponse.json({ products });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const body = await req.json();
    const { name, categoryId, warehouseId: inputWarehouseId, variants } = body;

    const warehouseId =
      session.user.role === "WAREHOUSE_ADMIN" && session.user.warehouseId
        ? session.user.warehouseId
        : inputWarehouseId;

    if (!name || !categoryId || !warehouseId) {
      return NextResponse.json(
        { error: "Nama produk, kategori, dan gudang wajib diisi" },
        { status: 400 }
      );
    }

    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json(
        { error: "1 produk wajib memiliki minimal 1 SKU / varian produk" },
        { status: 400 }
      );
    }

    const product = await inventoryService.createProduct(
      {
        name,
        categoryId,
        warehouseId,
        variants,
      },
      session.user.id
    );

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("sudah digunakan")
      ? 409
      : message.includes("tidak ditemukan")
      ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
