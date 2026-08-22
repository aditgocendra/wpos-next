import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { categoryService } from "@/services/category.service";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Super Admin access required" },
        { status: 403 }
      );
    }

    const categories = await categoryService.getAllCategories();
    return NextResponse.json({ categories });
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
    const { name, code, parentId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { error: "Nama dan kode kategori wajib diisi" },
        { status: 400 }
      );
    }

    const category = await categoryService.createCategory({
      name,
      code,
      parentId,
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    const status = message.includes("sudah digunakan")
      ? 409
      : message.includes("tidak ditemukan")
      ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
