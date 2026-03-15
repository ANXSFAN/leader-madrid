import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const path = (formData.get("path") as string) || "uploads";
    const bucket = (formData.get("bucket") as string) || "public-files";

    // Only allow known buckets
    const ALLOWED_BUCKETS = ["public-files", "images"];
    if (!ALLOWED_BUCKETS.includes(bucket)) {
      return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const ext = file.name.split(".").pop();
    const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      console.error("Supabase upload error:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return NextResponse.json({ url: urlData.publicUrl, path: data.path });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { urls } = await req.json();
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL;
    let deleted = 0;

    // Group paths by bucket
    const bucketPaths: Record<string, string[]> = {};
    for (const url of urls) {
      if (typeof url !== "string" || !url.includes(supabaseHost!)) continue;
      // URL format: {supabaseUrl}/storage/v1/object/public/{bucket}/{path}
      const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
      if (!match) continue;
      const [, bucket, path] = match;
      if (!bucketPaths[bucket]) bucketPaths[bucket] = [];
      bucketPaths[bucket].push(path);
    }

    for (const [bucket, paths] of Object.entries(bucketPaths)) {
      const { data, error } = await supabase.storage.from(bucket).remove(paths);
      if (error) {
        console.error(`Storage delete error (${bucket}):`, error);
      } else {
        deleted += data?.length ?? 0;
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error("Storage delete error:", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
