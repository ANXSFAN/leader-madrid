/**
 * Download real photos from Unsplash and upload to Supabase Storage
 * for banners and category images.
 *
 * Usage: npx tsx scripts/download-unsplash-images.ts
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const BUCKET = "public-files";

// ============================================================
// Image sources - Unsplash direct URLs (free to use)
// ============================================================

const IMAGES: Record<string, { url: string; desc: string }> = {
  // === BANNERS (1920x900 crop) ===
  "banner-led": {
    url: "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=1920&h=900&fit=crop&crop=center&q=80",
    desc: "Modern LED lighting showroom",
  },
  "banner-b2b": {
    url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=900&fit=crop&crop=center&q=80",
    desc: "Professional office/warehouse B2B",
  },

  // === TOP-LEVEL CATEGORIES (800x600 crop) ===
  "cat-iluminacion-tecnica": {
    url: "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Technical lighting - recessed downlights",
  },
  "cat-iluminacion-decorativa": {
    url: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Decorative lighting - pendant lamps",
  },
  "cat-iluminacion-exterior-industrial": {
    url: "https://images.unsplash.com/photo-1513828583688-c52646db42da?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Outdoor/industrial lighting",
  },
  "cat-componentes-accesorios": {
    url: "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "LED components and accessories",
  },

  // === SUB-CATEGORIES ===
  "cat-downlight-paneles": {
    url: "https://images.unsplash.com/photo-1565814329452-e1ced3cd53a4?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "LED downlights and panels in ceiling",
  },
  "cat-focos-de-carril": {
    url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Track lighting in retail store",
  },
  "cat-lamparas-de-techo": {
    url: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Ceiling pendant lamps",
  },
  "cat-lamparas-pared-mesa": {
    url: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Wall and table lamps",
  },
  "cat-exterior": {
    url: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Outdoor landscape lighting",
  },
  "cat-industrial": {
    url: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Industrial warehouse lighting",
  },
  "cat-fuentes-de-luz": {
    url: "https://images.unsplash.com/photo-1532007489852-bb656be9e5e8?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "LED bulbs / light sources",
  },
  "cat-alimentacion": {
    url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Electronic power supply components",
  },
  "cat-seguridad": {
    url: "https://images.unsplash.com/photo-1558002038-1055907df827?w=800&h=600&fit=crop&crop=center&q=80",
    desc: "Emergency/safety lighting exit sign",
  },
};

// Mapping: image key -> category slug (for categories that need updating)
const CATEGORY_MAP: Record<string, string> = {
  "cat-iluminacion-tecnica": "iluminacion-tecnica",
  "cat-iluminacion-decorativa": "iluminacion-decorativa",
  "cat-iluminacion-exterior-industrial": "iluminacion-exterior-industrial",
  "cat-componentes-accesorios": "componentes-accesorios",
  "cat-downlight-paneles": "downlight-paneles",
  "cat-focos-de-carril": "focos-de-carril",
  "cat-lamparas-de-techo": "lamparas-de-techo",
  "cat-lamparas-pared-mesa": "lamparas-pared-mesa",
  "cat-exterior": "exterior",
  "cat-industrial": "industrial",
  "cat-fuentes-de-luz": "fuentes-de-luz",
  "cat-alimentacion": "alimentacion",
  "cat-seguridad": "seguridad",
};

// ============================================================
// Download & Upload
// ============================================================

async function downloadAndUpload(
  imageUrl: string,
  storagePath: string
): Promise<string> {
  console.log(`  下载: ${imageUrl.substring(0, 80)}...`);

  const response = await fetch(imageUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "image/jpeg";

  console.log(`  上传: ${storagePath} (${(buffer.length / 1024).toFixed(0)}KB)`);

  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log("=== 从 Unsplash 下载真实照片 ===\n");

  const uploadedUrls: Record<string, string> = {};

  for (const [key, img] of Object.entries(IMAGES)) {
    try {
      const ext = ".jpg";
      let storagePath: string;

      if (key.startsWith("banner-")) {
        storagePath = `banners/${key}${ext}`;
      } else if (key.startsWith("cat-")) {
        const slug = CATEGORY_MAP[key];
        storagePath = `categories/${slug}${ext}`;
      } else {
        continue;
      }

      console.log(`\n[${key}] ${img.desc}`);
      const publicUrl = await downloadAndUpload(img.url, storagePath);
      uploadedUrls[key] = publicUrl;
      console.log(`  ✓ ${publicUrl.substring(0, 70)}...`);

      await delay(500); // be nice to Unsplash
    } catch (err) {
      console.error(`  ✗ 失败 [${key}]:`, (err as Error).message);
    }
  }

  // Update banner records
  console.log("\n=== 更新 Banner 数据库 ===");
  if (uploadedUrls["banner-led"]) {
    await prisma.banner.updateMany({
      where: { title: "Main Hero — LED Profesional" },
      data: { imageUrl: uploadedUrls["banner-led"] },
    });
    console.log("✓ Banner 1 已更新");
  }
  if (uploadedUrls["banner-b2b"]) {
    await prisma.banner.updateMany({
      where: { title: "B2B Program Banner" },
      data: { imageUrl: uploadedUrls["banner-b2b"] },
    });
    console.log("✓ Banner 2 已更新");
  }

  // Update category records
  console.log("\n=== 更新分类图片 ===");
  let catUpdated = 0;
  for (const [key, slug] of Object.entries(CATEGORY_MAP)) {
    const url = uploadedUrls[key];
    if (!url) continue;

    const cat = await prisma.category.findUnique({
      where: { slug },
      select: { id: true, content: true },
    });
    if (!cat) continue;

    const content = (cat.content as Record<string, any>) || {};
    content.imageUrl = url;
    await prisma.category.update({
      where: { id: cat.id },
      data: { content },
    });
    catUpdated++;
    console.log(`✓ ${slug}`);
  }

  console.log(`\n=== 完成 ===`);
  console.log(`Banner: ${uploadedUrls["banner-led"] ? 1 : 0} + ${uploadedUrls["banner-b2b"] ? 1 : 0} 已更新`);
  console.log(`分类: ${catUpdated} 已更新`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
