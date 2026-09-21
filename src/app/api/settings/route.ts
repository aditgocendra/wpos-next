import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.systemSetting.findMany();
    
    // Convert to a key-value object for easier frontend consumption
    const settingsMap = settings.reduce((acc: Record<string, string>, setting) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {});

    return NextResponse.json({ data: settingsMap });
  } catch (error: any) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat mengambil pengaturan" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only SUPER_ADMIN should be able to update global settings
    if (!session || !session.user || session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Key dan Value harus diisi" },
        { status: 400 }
      );
    }

    // Upsert the setting (create if not exists, update if exists)
    const setting = await prisma.systemSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description: description || "" },
    });

    return NextResponse.json({ data: setting, message: "Pengaturan berhasil disimpan" });
  } catch (error: any) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan saat menyimpan pengaturan" },
      { status: 500 }
    );
  }
}
