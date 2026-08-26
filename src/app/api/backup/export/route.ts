import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat melakukan backup." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const isArchive = searchParams.get("archive") === "true";
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // 1. Fetch all data
    const [
      users,
      warehouses,
      categories,
      products,
      productVariants,
      stockTransfers,
      stockTransferItems,
      transactions,
      transactionItems,
    ] = await Promise.all([
      prisma.user.findMany(),
      prisma.warehouse.findMany(),
      prisma.category.findMany(),
      prisma.product.findMany(),
      prisma.productVariant.findMany(),
      prisma.stockTransfer.findMany(),
      prisma.stockTransferItem.findMany(),
      prisma.transaction.findMany(),
      prisma.transactionItem.findMany(),
    ]);

    const backupData = {
      timestamp: new Date().toISOString(),
      models: {
        users,
        warehouses,
        categories,
        products,
        productVariants,
        stockTransfers,
        stockTransferItems,
        transactions,
        transactionItems,
      },
    };

    // 2. If archiving is requested, delete transaction data
    if (isArchive) {
      let deleteFilter: any = {};
      if (fromParam && toParam) {
        const endDate = new Date(toParam);
        endDate.setHours(23, 59, 59, 999);
        deleteFilter = {
          where: {
            createdAt: {
              gte: new Date(fromParam),
              lte: endDate,
            },
          },
        };
      }

      await prisma.$transaction([
        prisma.transactionItem.deleteMany(deleteFilter),
        prisma.transaction.deleteMany(deleteFilter),
        prisma.stockTransferItem.deleteMany(deleteFilter),
        prisma.stockTransfer.deleteMany(deleteFilter),
      ]);
    }

    // 3. Return JSON response as downloadable file
    const filename = `wpos-backup-${new Date().toISOString().split("T")[0]}.json`;
    return new NextResponse(JSON.stringify(backupData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Backup Export Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan internal server saat melakukan backup." },
      { status: 500 }
    );
  }
}
