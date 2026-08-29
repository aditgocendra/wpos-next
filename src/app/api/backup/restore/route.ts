import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user?.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang dapat melakukan restore." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "File backup (.json) tidak ditemukan." },
        { status: 400 }
      );
    }

    const fileContent = await file.text();
    const data = JSON.parse(fileContent);

    if (!data.models) {
      return NextResponse.json(
        { error: "Format file JSON tidak valid atau bukan berasal dari sistem ini." },
        { status: 400 }
      );
    }

    const {
      users = [],
      warehouses = [],
      categories = [],
      products = [],
      productVariants = [],
      productVariantStocks = [],
      stockTransfers = [],
      stockTransferItems = [],
      transactions = [],
      transactionItems = [],
    } = data.models;

    // Get existing users to validate foreign keys for records referencing User(id)
    const existingUsers = await prisma.user.findMany({ select: { id: true } });
    const existingUserIds = new Set(existingUsers.map((u) => u.id));
    const fallbackUserId = session.user.id;

    const sanitizeUserRef = (items: any[]) => {
      return items.map((item) => ({
        ...item,
        createdById:
          item.createdById && existingUserIds.has(item.createdById)
            ? item.createdById
            : fallbackUserId,
        updatedById:
          item.updatedById && existingUserIds.has(item.updatedById)
            ? item.updatedById
            : item.updatedById
            ? fallbackUserId
            : null,
      }));
    };

    const sanitizedProducts = sanitizeUserRef(products);
    const sanitizedProductVariants = sanitizeUserRef(productVariants);
    const sanitizedStockTransfers = sanitizeUserRef(stockTransfers);
    const sanitizedTransactions = sanitizeUserRef(transactions);

    // Use Prisma transaction to insert data sequentially
    // We use createMany with skipDuplicates: true to safely insert records while preserving their IDs and ignoring existing ones.
    const transactionOperations = [
      prisma.warehouse.createMany({ data: warehouses, skipDuplicates: true }),
      ...(users && users.length > 0
        ? [prisma.user.createMany({ data: users, skipDuplicates: true })]
        : []),
      // For Categories with self-relation, it might need multiple passes if ordering is strictly enforced by DB immediately,
      // but usually the JSON backup retains the insertion order roughly. We'll do createMany directly.
      prisma.category.createMany({ data: categories, skipDuplicates: true }),
      prisma.product.createMany({ data: sanitizedProducts, skipDuplicates: true }),
      prisma.productVariant.createMany({ data: sanitizedProductVariants, skipDuplicates: true }),
      ...(productVariantStocks && productVariantStocks.length > 0
        ? [prisma.productVariantStock.createMany({ data: productVariantStocks, skipDuplicates: true })]
        : []),
      // Transactions and Stock Transfers
      prisma.stockTransfer.createMany({ data: sanitizedStockTransfers, skipDuplicates: true }),
      prisma.stockTransferItem.createMany({ data: stockTransferItems, skipDuplicates: true }),
      prisma.transaction.createMany({ data: sanitizedTransactions, skipDuplicates: true }),
      prisma.transactionItem.createMany({ data: transactionItems, skipDuplicates: true }),
    ];

    await prisma.$transaction(transactionOperations);

    return NextResponse.json(
      { message: "Restore berhasil dilakukan." },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Backup Restore Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses restore: " + error.message },
      { status: 500 }
    );
  }
}
