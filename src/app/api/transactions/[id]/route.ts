import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transactionService } from "@/services/transaction.service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "SUPER_ADMIN" && session.user.role !== "CASHIER")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin atau Cashier access required" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const transaction = await transactionService.getTransactionById(id);

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaksi tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ transaction });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat mengubah data transaksi" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { warehouseId, items, notes } = body;

    const transaction = await transactionService.updateTransaction(
      id,
      {
        warehouseId,
        items,
        notes,
      },
      session.user.id
    );

    return NextResponse.json({ transaction });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat menghapus data transaksi" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const result = await transactionService.deleteTransaction(id);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
