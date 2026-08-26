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
      stockTransfers = [],
      stockTransferItems = [],
      transactions = [],
      transactionItems = [],
    } = data.models;

    // Use Prisma transaction to insert data sequentially
    // We use createMany with skipDuplicates: true to safely insert records while preserving their IDs and ignoring existing ones.
    await prisma.$transaction([
      prisma.warehouse.createMany({ data: warehouses, skipDuplicates: true }),
      prisma.user.createMany({ data: users, skipDuplicates: true }),
      // For Categories with self-relation, it might need multiple passes if ordering is strictly enforced by DB immediately,
      // but usually the JSON backup retains the insertion order roughly. We'll do createMany directly.
      prisma.category.createMany({ data: categories, skipDuplicates: true }),
      prisma.product.createMany({ data: products, skipDuplicates: true }),
      prisma.productVariant.createMany({ data: productVariants, skipDuplicates: true }),
      
      // Transactions and Stock Transfers
      prisma.stockTransfer.createMany({ data: stockTransfers, skipDuplicates: true }),
      prisma.stockTransferItem.createMany({ data: stockTransferItems, skipDuplicates: true }),
      prisma.transaction.createMany({ data: transactions, skipDuplicates: true }),
      prisma.transactionItem.createMany({ data: transactionItems, skipDuplicates: true }),
    ]);

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
