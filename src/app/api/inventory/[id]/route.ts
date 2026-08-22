import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inventoryService } from "@/services/inventory.service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
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
    const product = await inventoryService.getProductById(id);

    if (!product) {
      return NextResponse.json(
        { error: "Produk tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ product });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: Request, context: RouteContext) {
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
    const { name, categoryId, warehouseId, variants } = body;

    const product = await inventoryService.updateProduct(
      id,
      {
        name,
        categoryId,
        warehouseId,
        variants,
      },
      session.user.id
    );

    return NextResponse.json({ product });
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

export async function DELETE(req: Request, context: RouteContext) {
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
    const result = await inventoryService.deleteProduct(id);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("tidak ditemukan") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
