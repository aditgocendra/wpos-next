import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { transferService } from "@/services/transfer.service";

export async function POST(
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
    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    const transfer = await transferService.cancelTransfer(
      id,
      session.user.id,
      reason
    );

    return NextResponse.json({
      success: true,
      message: "Transfer stok berhasil ditolak/dibatalkan",
      transfer,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
