import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transferService } from "@/services/transfer.service";

export async function GET(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
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

    const { id } = await props.params;
    const transfer = await transferService.getTransferById(id);

    if (!transfer) {
      return NextResponse.json(
        { error: "Transfer stok tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
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

    const { id } = await props.params;
    const body = await req.json();
    const { sourceWarehouseId, destinationWarehouseId, items, notes } = body;

    const transfer = await transferService.updateTransfer(
      id,
      {
        sourceWarehouseId,
        destinationWarehouseId,
        items,
        notes,
      },
      session.user.id
    );

    return NextResponse.json({ transfer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat menghapus data transfer" },
        { status: 403 }
      );
    }

    const { id } = await props.params;
    await transferService.deleteTransfer(id, session.user.role);

    return NextResponse.json({ success: true, message: "Transfer berhasil dihapus" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
