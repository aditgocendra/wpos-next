import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

export const BUCKET_NAME =
  process.env.SUPABASE_BUCKET_NAME ||
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET ||
  "product-dev";

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    auth: {
      persistSession: false,
    },
  }
);

/**
 * Extracts storage relative file path (e.g. "variants/xyz.webp") from public URL.
 */
export function extractStoragePath(imageUrl: string, bucketName = BUCKET_NAME): string | null {
  if (!imageUrl || typeof imageUrl !== "string") return null;

  const publicPrefix = `/storage/v1/object/public/${bucketName}/`;
  const idx = imageUrl.indexOf(publicPrefix);
  if (idx !== -1) {
    return imageUrl.substring(idx + publicPrefix.length);
  }

  // Fallback if URL is formatted differently or already relative
  if (imageUrl.startsWith("variants/")) {
    return imageUrl;
  }

  return null;
}

/**
 * Deletes one or multiple files from Supabase Storage bucket.
 */
export async function deleteStorageFiles(imageUrls: string[]): Promise<void> {
  const paths = imageUrls
    .map((url) => extractStoragePath(url))
    .filter((p): p is string => Boolean(p));

  if (paths.length === 0) return;

  try {
    const { error } = await supabase.storage.from(BUCKET_NAME).remove(paths);
    if (error) {
      console.error("Supabase deleteStorageFiles error:", error);
    }
  } catch (err) {
    console.error("Failed to delete storage files:", err);
  }
}
