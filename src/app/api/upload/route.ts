import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabase, BUCKET_NAME } from "@/lib/supabase";
import sharp from "sharp";

export const runtime = "nodejs";

const MAX_RAW_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_TARGET_SIZE_BYTES = 512 * 1024; // 512 KB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Otorisasi Ketat: Hanya SUPER_ADMIN yang dapat mengunggah gambar
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Hanya Super Admin yang memiliki izin mengunggah gambar produk." },
        { status: 403 }
      );
    }

    // 2. Proteksi Keamanan: Mencegah upload dari luar website (Anti-Cross-Site / CSRF)
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host");
    const secFetchSite = req.headers.get("sec-fetch-site");

    // Jika browser mengirimkan header sec-fetch-site dan berasal dari cross-site, tolak
    if (secFetchSite && secFetchSite === "cross-site") {
      return NextResponse.json(
        { error: "Forbidden: Permintaan upload dari luar website tidak diizinkan." },
        { status: 403 }
      );
    }

    // Validasi domain origin dan referer terhadap host server
    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: "Forbidden: Origin request tidak sesuai dengan host website." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Forbidden: Format origin tidak valid." }, { status: 403 });
      }
    } else if (referer && host) {
      try {
        const refererUrl = new URL(referer);
        if (refererUrl.host !== host) {
          return NextResponse.json(
            { error: "Forbidden: Referer request tidak sesuai dengan host website." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Forbidden: Format referer tidak valid." }, { status: 403 });
      }
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "File gambar tidak ditemukan." },
        { status: 400 }
      );
    }

    // 3. Validasi Ukuran Maksimal Server (Tolak jika > 2 MB)
    if (file.size > MAX_RAW_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Ukuran file terlalu besar. Maksimal 2 MB sebelum kompresi.",
        },
        { status: 413 }
      );
    }

    // 2. Validasi Tipe File
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Format file tidak didukung. Hanya JPG, PNG, dan WebP yang diizinkan.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Optimasi & Kompresi Server-Side dengan Sharp (Target WebP & < 512 KB)
    let processedBuffer: Buffer;
    let quality = 80;

    // First attempt: Convert to webp with quality 80
    processedBuffer = await sharp(buffer)
      .rotate() // Auto-rotate based on EXIF
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();

    // If still > 512 KB, progressively reduce quality / dimension
    while (processedBuffer.length > MAX_TARGET_SIZE_BYTES && quality > 30) {
      quality -= 15;
      processedBuffer = await sharp(buffer)
        .rotate()
        .resize({ width: 1440, height: 1440, fit: "inside", withoutEnlargement: true })
        .webp({ quality })
        .toBuffer();
    }

    if (processedBuffer.length > MAX_TARGET_SIZE_BYTES) {
      return NextResponse.json(
        {
          error:
            "Gambar gagal dikompresi di bawah 512 KB. Silakan pilih gambar lain.",
        },
        { status: 422 }
      );
    }

    // 4. Upload ke Supabase Storage
    const fileName = `variants/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, processedBuffer, {
        contentType: "image/webp",
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      console.error("Supabase storage upload error:", uploadError);
      return NextResponse.json(
        {
          error: `Gagal mengunggah ke Supabase Storage: ${uploadError.message}`,
        },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return NextResponse.json({
      url: publicUrl,
      fileName,
      size: processedBuffer.length,
    });
  } catch (error) {
    console.error("Upload route error:", error);
    const message =
      error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
