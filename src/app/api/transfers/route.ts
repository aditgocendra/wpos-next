import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transferService } from "@/services/transfer.service";
import type { TransferStatus } from "@/generated/prisma/client";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const warehouseIdParam = searchParams.get("warehouseId") || undefined;
    const sourceWarehouseId = searchParams.get("sourceWarehouseId") || undefined;
    const destinationWarehouseId = searchParams.get("destinationWarehouseId") || undefined;
    const status = (searchParams.get("status") as TransferStatus) || undefined;
    const search = searchParams.get("search") || undefined;

    let warehouseId = warehouseIdParam;
    // If warehouse admin, strictly filter to their warehouse
    if (session.user.role === "WAREHOUSE_ADMIN" && session.user.warehouseId) {
      warehouseId = session.user.warehouseId;
    }

    const transfers = await transferService.getTransfers({
      warehouseId,
      sourceWarehouseId,
      destinationWarehouseId,
      status,
      search,
    });

    return NextResponse.json({ transfers });
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
    let { sourceWarehouseId, destinationWarehouseId, items, notes } = body;

    if (session.user.role === "WAREHOUSE_ADMIN" && session.user.warehouseId) {
      sourceWarehouseId = session.user.warehouseId;
    }

    if (!sourceWarehouseId || !destinationWarehouseId) {
      return NextResponse.json(
        { error: "Gudang asal dan tujuan wajib dipilih" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Daftar barang transfer tidak boleh kosong" },
        { status: 400 }
      );
    }

    const transfer = await transferService.createTransferOrder(
      {
        sourceWarehouseId,
        destinationWarehouseId,
        items,
        notes,
      },
      session.user.id
    );

    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
