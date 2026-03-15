const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

/** Check if a URL belongs to our Supabase storage */
export function isSupabaseUrl(url: string): boolean {
  return !!SUPABASE_HOST && url.includes(SUPABASE_HOST);
}

/** Delete one or more files from Supabase storage via the /api/upload DELETE endpoint */
export async function deleteStorageUrls(urls: string[]): Promise<void> {
  const supabaseUrls = urls.filter(isSupabaseUrl);
  if (supabaseUrls.length === 0) return;

  try {
    await fetch("/api/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: supabaseUrls }),
    });
  } catch (err) {
    console.error("Failed to delete storage files:", err);
  }
}
