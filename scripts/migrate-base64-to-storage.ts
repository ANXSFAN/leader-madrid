/**
 * 迁移脚本：将数据库中所有 base64 图片上传到 Supabase Storage
 *
 * 扫描范围：
 *   1. Product.content.images[]        → images bucket / products/
 *   2. Category.content.*.image        → images bucket / categories/
 *   3. Banner.imageUrl                 → images bucket / banners/
 *
 * 用法：
 *   npx tsx scripts/migrate-base64-to-storage.ts
 *
 * 前置条件：
 *   - .env 里已配好 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL
 *   - Supabase 已创建 "images" bucket 且设为 public
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ── 初始化 ──────────────────────────────────────────────────
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL } },
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET = "images";
let uploadCount = 0;
let skipCount = 0;
let errorCount = 0;

// ── 工具函数 ────────────────────────────────────────────────

function isBase64(str: string): boolean {
  return typeof str === "string" && str.startsWith("data:image/");
}

/**
 * 将 base64 data URL 上传到 Supabase Storage，返回公开 URL
 */
async function uploadBase64(dataUrl: string, folder: string): Promise<string> {
  // 解析 data URL：data:image/webp;base64,AAAA...
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL format");

  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: `image/${match[1]}`,
      upsert: false,
    });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ── 1. 迁移 Product 图片 ────────────────────────────────────

async function migrateProducts() {
  console.log("\n── Products ──────────────────────────────────");
  const products = await prisma.product.findMany({ select: { id: true, slug: true, content: true } });
  console.log(`Found ${products.length} products`);

  for (const product of products) {
    const content = product.content as any;
    if (!content?.images || !Array.isArray(content.images)) continue;

    let changed = false;
    const newImages: string[] = [];

    for (const img of content.images) {
      if (isBase64(img)) {
        try {
          const url = await uploadBase64(img, "products");
          newImages.push(url);
          changed = true;
          uploadCount++;
          console.log(`  ✓ Product "${product.slug}" — uploaded image → ${url.split("/").pop()}`);
        } catch (err: any) {
          console.error(`  ✗ Product "${product.slug}" — upload failed:`, err.message);
          newImages.push(img); // 保留原值不丢数据
          errorCount++;
        }
      } else {
        newImages.push(img);
        skipCount++;
      }
    }

    if (changed) {
      content.images = newImages;
      await prisma.product.update({
        where: { id: product.id },
        data: { content },
      });
    }
  }
}

// ── 2. 迁移 Category 图片 ───────────────────────────────────

async function migrateCategories() {
  console.log("\n── Categories ────────────────────────────────");
  const categories = await prisma.category.findMany({ select: { id: true, slug: true, content: true } });
  console.log(`Found ${categories.length} categories`);

  for (const cat of categories) {
    const content = cat.content as any;
    if (!content || typeof content !== "object") continue;

    let changed = false;

    // content 结构: { en: { name, description, image? }, es: { ... }, images?: [...] }
    for (const key of Object.keys(content)) {
      const locale = content[key];

      // 检查 locale.image（单图）
      if (locale && typeof locale === "object" && typeof locale.image === "string" && isBase64(locale.image)) {
        try {
          const url = await uploadBase64(locale.image, "categories");
          locale.image = url;
          changed = true;
          uploadCount++;
          console.log(`  ✓ Category "${cat.slug}" [${key}] — uploaded image → ${url.split("/").pop()}`);
        } catch (err: any) {
          console.error(`  ✗ Category "${cat.slug}" [${key}] — upload failed:`, err.message);
          errorCount++;
        }
      }
    }

    // 也检查顶层 images 数组（同 product 结构）
    if (Array.isArray(content.images)) {
      const newImages: string[] = [];
      for (const img of content.images) {
        if (isBase64(img)) {
          try {
            const url = await uploadBase64(img, "categories");
            newImages.push(url);
            changed = true;
            uploadCount++;
            console.log(`  ✓ Category "${cat.slug}" — uploaded images[] → ${url.split("/").pop()}`);
          } catch (err: any) {
            newImages.push(img);
            errorCount++;
          }
        } else {
          newImages.push(img);
        }
      }
      if (changed) content.images = newImages;
    }

    if (changed) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { content },
      });
    }
  }
}

// ── 3. 迁移 Banner 图片 ────────────────────────────────────

async function migrateBanners() {
  console.log("\n── Banners ───────────────────────────────────");
  const banners = await prisma.banner.findMany({ select: { id: true, title: true, imageUrl: true } });
  console.log(`Found ${banners.length} banners`);

  for (const banner of banners) {
    if (isBase64(banner.imageUrl)) {
      try {
        const url = await uploadBase64(banner.imageUrl, "banners");
        await prisma.banner.update({
          where: { id: banner.id },
          data: { imageUrl: url },
        });
        uploadCount++;
        console.log(`  ✓ Banner "${banner.title}" — uploaded → ${url.split("/").pop()}`);
      } catch (err: any) {
        console.error(`  ✗ Banner "${banner.title}" — upload failed:`, err.message);
        errorCount++;
      }
    } else {
      skipCount++;
    }
  }
}

// ── 主函数 ──────────────────────────────────────────────────

async function main() {
  console.log("=== Base64 → Supabase Storage Migration ===");
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Supabase URL: ${supabaseUrl}`);

  await migrateProducts();
  await migrateCategories();
  await migrateBanners();

  console.log("\n=== Migration Complete ===");
  console.log(`  Uploaded:  ${uploadCount}`);
  console.log(`  Skipped:   ${skipCount} (already URL)`);
  console.log(`  Errors:    ${errorCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
