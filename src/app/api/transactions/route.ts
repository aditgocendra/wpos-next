import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transactionService } from "@/services/transaction.service";

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const warehouseIdParam = searchParams.get("warehouseId") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as "productName" | "createdAt") || undefined;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || undefined;

    let warehouseId = warehouseIdParam;
    if (session.user.role === "CASHIER" && session.user.warehouseId) {
      warehouseId = session.user.warehouseId;
    }

    const transactions = await transactionService.getTransactions({
      warehouseId,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ transactions });
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
      (session.user.role !== "SUPER_ADMIN" && session.user.role !== "CASHIER")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Super Admin atau Cashier access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { items, notes } = body;
    let warehouseId = body.warehouseId;

    if (session.user.role === "CASHIER" && session.user.warehouseId) {
      warehouseId = session.user.warehouseId;
    }

    if (!warehouseId) {
      return NextResponse.json(
        { error: "Gudang transaksi wajib dipilih" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Daftar barang penjualan tidak boleh kosong" },
        { status: 400 }
      );
    }

    const transaction = await transactionService.createTransaction(
      {
        warehouseId,
        items,
        notes,
      },
      session.user.id
    );

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
