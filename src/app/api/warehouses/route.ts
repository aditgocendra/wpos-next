import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { warehouseService } from "@/services/warehouse.service";

export async function GET() {
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

    const [warehouses, adminUsers] = await Promise.all([
      warehouseService.getAllWarehouses(),
      warehouseService.getWarehouseAdminUsers(),
    ]);

    return NextResponse.json({ warehouses, adminUsers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, code, address, adminUserId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Warehouse name and code are required" },
        { status: 400 }
      );
    }

    const warehouse = await warehouseService.createWarehouse({
      name,
      code,
      address,
      adminUserId,
    });

    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
