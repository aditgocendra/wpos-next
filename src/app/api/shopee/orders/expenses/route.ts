import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { shopeeOrderService } from "@/services/shopee-order.service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const integrationId = searchParams.get("integrationId");
    const month = searchParams.get("month");

    if (!integrationId || !month) {
      return NextResponse.json(
        { error: "Parameter 'integrationId' dan 'month' wajib diisi." },
        { status: 400 }
      );
    }

    const expense = await shopeeOrderService.getMonthlyExpense(integrationId, month);

    return NextResponse.json({
      success: true,
      expense: expense || {
        adCost: 0,
        operationalCost: 0,
        unexpectedCost: 0,
        notes: "",
      },
    });
  } catch (error) {
    console.error("[GET /api/shopee/orders/expenses] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal mengambil data biaya bulanan",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { integrationId, month, adCost, operationalCost, unexpectedCost, notes } = body;

    if (!integrationId || !month) {
      return NextResponse.json(
        { error: "Field 'integrationId' dan 'month' wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await shopeeOrderService.upsertMonthlyExpense({
      integrationId,
      month,
      adCost: Number(adCost) || 0,
      operationalCost: Number(operationalCost) || 0,
      unexpectedCost: Number(unexpectedCost) || 0,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: "Biaya bulanan berhasil diperbarui",
      expense: updated,
    });
  } catch (error) {
    console.error("[POST /api/shopee/orders/expenses] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal menyimpan biaya bulanan",
      },
      { status: 500 }
    );
  }
}
