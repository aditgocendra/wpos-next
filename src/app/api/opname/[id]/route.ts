import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { opnameService } from "@/services/opname.service";

export async function GET(
  _req: Request,
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

    const opname = await opnameService.getOpnameById(id, {
      id: session.user.id,
      role: session.user.role,
      warehouseId: session.user.warehouseId,
    });

    return NextResponse.json({ data: opname });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Forbidden") ? 403 : message.includes("tidak ditemukan") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
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

    const updated = await opnameService.updateOpname(id, body, {
      id: session.user.id,
      role: session.user.role,
      warehouseId: session.user.warehouseId,
    });

    return NextResponse.json({
      message: "Stock opname berhasil diperbarui",
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
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

    await opnameService.deleteOpname(id, {
      id: session.user.id,
      role: session.user.role,
      warehouseId: session.user.warehouseId,
    });

    return NextResponse.json({ message: "Stock opname berhasil dihapus" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("Forbidden") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
