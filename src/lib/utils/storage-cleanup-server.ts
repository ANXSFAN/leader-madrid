import { getServiceSupabase } from "@/lib/supabase";

const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/** Extract bucket and path from a Supabase storage public URL */
function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  if (!SUPABASE_HOST || !url.includes(SUPABASE_HOST)) return null;
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

/** Delete files from Supabase storage given their public URLs (server-side) */
export async function cleanupStorageUrls(urls: string[]): Promise<void> {
  const bucketPaths: Record<string, string[]> = {};

  for (const url of urls) {
    const parsed = parseStorageUrl(url);
    if (!parsed) continue;
    if (!bucketPaths[parsed.bucket]) bucketPaths[parsed.bucket] = [];
    bucketPaths[parsed.bucket].push(parsed.path);
  }

  if (Object.keys(bucketPaths).length === 0) return;

  try {
    const supabase = getServiceSupabase();
    for (const [bucket, paths] of Object.entries(bucketPaths)) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        console.error(`Storage cleanup error (${bucket}):`, error);
      }
    }
  } catch (err) {
    console.error("Storage cleanup failed:", err);
  }
}
