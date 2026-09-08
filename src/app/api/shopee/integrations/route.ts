import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integrations = await prisma.integration.findMany({
      include: {
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            products: true,
            syncJobs: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const warehouses = await prisma.warehouse.findMany({
      select: {
        id: true,
        name: true,
        code: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ integrations, warehouses });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, warehouseId, status } = body;

    if (!id) {
      return NextResponse.json({ error: "ID integrasi diperlukan" }, { status: 400 });
    }

    const data: { warehouseId?: string; status?: string } = {};

    if (warehouseId) {
      // Pastikan warehouse belum terhubung dengan toko Shopee lain
      const existing = await prisma.integration.findFirst({
        where: {
          warehouseId,
          platform: "SHOPEE",
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: "Gudang ini sudah terhubung dengan toko Shopee lain." },
          { status: 400 }
        );
      }
      data.warehouseId = warehouseId;
    }

    if (status) {
      data.status = status;
    }

    const updated = await prisma.integration.update({
      where: { id },
      data,
      include: {
        warehouse: true,
      },
    });

    return NextResponse.json({ integration: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID integrasi diperlukan" }, { status: 400 });
    }

    await prisma.integration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
