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
    const month = searchParams.get("month") || undefined;
    const search = searchParams.get("search") || undefined;
    const sortBy = (searchParams.get("sortBy") as "orderStatus" | "orderCreatedAt") || undefined;
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const refresh = searchParams.get("refresh") === "true";

    if (!integrationId) {
      return NextResponse.json(
        { error: "Parameter 'integrationId' (Toko Shopee) wajib diisi." },
        { status: 400 }
      );
    }

    const result = await shopeeOrderService.fetchLiveOrders({
      integrationId,
      month,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
      refresh,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[GET /api/shopee/orders] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal mengambil data pesanan Shopee",
      },
      { status: 500 }
    );
  }
}
