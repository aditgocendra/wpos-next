import imageCompression from "browser-image-compression";

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 512 * 1024; // 512 KB

export interface CompressImageOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
}

/**
 * Compress and convert image to WebP format in browser.
 * Throws error if invalid format or if compressed size still exceeds 512 KB.
 */
export async function compressClientImage(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      `Format file tidak didukung (${file.type}). Gunakan JPG, PNG, atau WebP.`
    );
  }

  const defaultOptions = {
    maxSizeMB: 0.49, // Target under 512 KB
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: "image/webp",
    ...options,
  };

  try {
    const compressedBlob = await imageCompression(file, defaultOptions);

    // Convert blob to File with .webp extension
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
    const compressedFile = new File(
      [compressedBlob],
      `${fileNameWithoutExt}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now(),
      }
    );

    if (compressedFile.size > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `Ukuran gambar setelah kompresi (${(compressedFile.size / 1024).toFixed(
          1
        )} KB) masih melebihi batas maksimal 512 KB.`
      );
    }

    return compressedFile;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Gagal mengompresi gambar");
  }
}
