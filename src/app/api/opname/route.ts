import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { opnameService } from "@/services/opname.service";
import type { StockOpnameStatus } from "@/generated/prisma/client";

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
    const warehouseId = searchParams.get("warehouseId") || undefined;
    const status = (searchParams.get("status") as StockOpnameStatus) || undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 10;

    const result = await opnameService.getOpnames(
      { warehouseId, status, search, page, limit },
      {
        id: session.user.id,
        role: session.user.role,
        warehouseId: session.user.warehouseId,
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
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

    const opname = await opnameService.createOpname(body, {
      id: session.user.id,
      role: session.user.role,
      warehouseId: session.user.warehouseId,
    });

    return NextResponse.json(
      { message: "Stock opname berhasil dibuat", data: opname },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.startsWith("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
