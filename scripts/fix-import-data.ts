/**
 * WooCommerce 导入数据修复脚本
 *
 * 修复从 WooCommerce 导入后的数据质量问题：
 *   1. 补充 en locale 内容 —— 将 es 内容复制到 en，确保 getLocalized() 的英文回退正常工作
 *   2. 修复产品 SKU —— 去掉丑陋的 "WC-slug" 格式，提取型号作为短 SKU
 *   3. 修复变体 SKU —— 同上逻辑
 *   4. 下载 WooCommerce 图片并上传到 Supabase Storage —— 替换外链为自托管链接
 *
 * 用法:
 *   npx tsx scripts/fix-import-data.ts                  # 执行全部修复
 *   npx tsx scripts/fix-import-data.ts --dry-run        # 预览模式，不写数据库
 *   npx tsx scripts/fix-import-data.ts --skip-images    # 跳过图片处理
 *   npx tsx scripts/fix-import-data.ts --images-only    # 仅执行图片处理
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";

dotenv.config();

// ==================== 初始化 ====================

const prisma = new PrismaClient();

const WC_URL = process.env.WOOCOMMERCE_URL || "";
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY || "";
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET || "";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_BUCKET = "public-files";

// 仅在需要时初始化 Supabase 客户端
function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("缺少 Supabase 环境变量 (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ==================== 命令行参数 ====================

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_IMAGES = args.includes("--skip-images");
const IMAGES_ONLY = args.includes("--images-only");

// ==================== 统计计数器 ====================

const stats = {
  // locale 修复
  productsLocaleFixed: 0,
  categoriesLocaleFixed: 0,
  // SKU 修复
  productSkusFixed: 0,
  variantSkusFixed: 0,
  // 图片处理
  imagesDownloaded: 0,
  imagesSkipped: 0,
  imagesFailed: 0,
  productsImageFixed: 0,
  categoriesImageFixed: 0,
  // 错误
  errors: [] as { item: string; error: string }[],
};

// ==================== 工具函数 ====================

/** 延迟 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 从 URL 提取文件扩展名 */
function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(ext) ? ext : ".jpg";
  } catch {
    return ".jpg";
  }
}

/** 短哈希 */
function shortHash(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").slice(0, 8);
}

/**
 * 从产品名称/slug 中提取型号作为短 SKU
 *
 * 匹配规则（按优先级）：
 *   1. 标准型号号码：如 CK671B, W4067-2B, 8112-B, 6018M, 7023-500 等
 *      正则：连续的字母数字组合，包含数字，可带连字符分段
 *   2. 如果名称中有多个型号候选，取最长/最具体的那个
 *   3. 如果匹配不到型号，去掉 WC- 前缀并截断到 30 字符
 */
function extractModelSku(name: string, slug: string, currentSku: string): string {
  // 先从产品名中尝试提取型号
  // 常见型号格式：纯数字+字母混合，可包含连字符
  // 例：CK671B, 8112-B, W4067-2B, 6018M, 7023-500-REDONDA, SH-5A-10W
  const modelPatterns = [
    // 格式1: 字母+数字+可选字母+可选连字符段 (如 CK671B, W4067-2B, SH-5A)
    /\b([A-Z]{1,4}\d{2,}(?:[-][A-Z0-9]+)*[A-Z]?)\b/gi,
    // 格式2: 数字开头+可选连字符段+可选字母 (如 8112-B, 7023-500, 6018M)
    /\b(\d{3,}(?:[-]\d+)*(?:[-]?[A-Z]{1,5})?)\b/gi,
    // 格式3: 数字+连字符+字母数字 (如 60-3264, 48-TP)
    /\b(\d{2,}[-][A-Z0-9]+(?:[-][A-Z0-9]+)*)\b/gi,
  ];

  let bestMatch = "";

  for (const pattern of modelPatterns) {
    const matches = name.match(pattern);
    if (matches) {
      for (const m of matches) {
        // 至少包含一个数字，且长度 >= 3
        if (/\d/.test(m) && m.length >= 3 && m.length > bestMatch.length) {
          bestMatch = m;
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch.toUpperCase();
  }

  // 没找到型号 —— 从 slug 生成简化 SKU
  // 去掉 "WC-" 前缀，去掉常见西语前缀词
  let cleaned = slug
    .replace(/^wc-/, "")
    .replace(/^(lampara|panel|foco|bombilla|tira|plafon|downlight|aplique|colgante|proyector|tubo)-de?-/i, "")
    .toUpperCase()
    .replace(/-+/g, "-");

  // 截断到 30 字符
  if (cleaned.length > 30) {
    cleaned = cleaned.substring(0, 30).replace(/-$/, "");
  }

  return cleaned;
}

// ==================== WooCommerce API ====================

interface WCImage {
  id: number;
  src: string;
  name: string;
  alt: string;
}

interface WCProduct {
  id: number;
  name: string;
  slug: string;
  images: WCImage[];
  variations: number[];
}

interface WCCategory {
  id: number;
  slug: string;
  image: { src: string } | null;
}

async function fetchWC<T = any>(
  endpoint: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`);
  url.searchParams.set("consumer_key", WC_KEY);
  url.searchParams.set("consumer_secret", WC_SECRET);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WC API 错误 [${res.status}]: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function fetchAllPages<T>(
  endpoint: string,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  let page = 1;
  const all: T[] = [];

  while (true) {
    console.log(`    获取 ${endpoint} 第 ${page} 页...`);
    const items = await fetchWC<T[]>(endpoint, {
      per_page: "100",
      page: String(page),
      ...extraParams,
    });
    if (!items || items.length === 0) break;
    all.push(...items);
    if (items.length < 100) break;
    page++;
    await delay(500);
  }

  return all;
}

// ==================== 图片下载上传 ====================

/**
 * 下载图片并上传到 Supabase Storage
 * 返回公开 URL，失败返回 null
 */
async function downloadAndUpload(
  imageUrl: string,
  storagePath: string,
  supabase: ReturnType<typeof createClient>
): Promise<string | null> {
  try {
    // 检查是否已存在
    const dir = path.dirname(storagePath).replace(/\\/g, "/");
    const filename = path.basename(storagePath);
    const { data: existing } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(dir, { search: filename });

    if (existing?.some((f) => f.name === filename)) {
      const { data: urlData } = supabase.storage
        .from(SUPABASE_BUCKET)
        .getPublicUrl(storagePath);
      stats.imagesSkipped++;
      return urlData.publicUrl;
    }

    // 下载
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // 上传
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(storagePath);

    stats.imagesDownloaded++;
    return urlData.publicUrl;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`      图片失败 ${imageUrl}: ${msg}`);
    stats.imagesFailed++;
    return null;
  }
}

// ==================== 步骤 1：修复 locale 回退 ====================

/**
 * 对所有产品和分类：如果 content 中有 es 但没有 en，
 * 将 es 的内容复制为 en，确保 getLocalized(content, "en") 正常工作。
 */
async function fixLocaleContent(): Promise<void> {
  console.log("\n========================================");
  console.log("  步骤 1：修复 locale 内容回退 (es → en)");
  console.log("========================================\n");

  // --- 产品 ---
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, content: true },
  });
  console.log(`  发现 ${products.length} 个产品，检查 locale 内容...\n`);

  for (const product of products) {
    const content = product.content as Record<string, any>;
    if (!content) continue;

    // 如果有 es 但没有 en（或 en.name 为空），复制 es → en
    if (content.es?.name && (!content.en || !content.en.name)) {
      content.en = { ...content.es };

      if (!DRY_RUN) {
        await prisma.product.update({
          where: { id: product.id },
          data: { content: content as Prisma.InputJsonValue },
        });
      }
      console.log(`    [产品] ${product.slug}: es → en 已复制`);
      stats.productsLocaleFixed++;
    }
  }

  // --- 分类 ---
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, content: true },
  });
  console.log(`\n  发现 ${categories.length} 个分类，检查 locale 内容...\n`);

  for (const cat of categories) {
    const content = cat.content as Record<string, any>;
    if (!content) continue;

    if (content.es?.name && (!content.en || !content.en.name)) {
      content.en = { ...content.es };

      if (!DRY_RUN) {
        await prisma.category.update({
          where: { id: cat.id },
          data: { content: content as Prisma.InputJsonValue },
        });
      }
      console.log(`    [分类] ${cat.slug}: es → en 已复制`);
      stats.categoriesLocaleFixed++;
    }
  }

  console.log(`\n  locale 修复完成: 产品 ${stats.productsLocaleFixed}, 分类 ${stats.categoriesLocaleFixed}`);
}

// ==================== 步骤 2 & 4：修复 SKU ====================

/**
 * 修复产品和变体 SKU：
 *   - 仅处理以 "WC-" 开头的 SKU
 *   - 尝试从产品名称中提取型号作为短 SKU
 *   - 确保唯一性：重复时追加 -2, -3 等后缀
 */
async function fixSkus(): Promise<void> {
  console.log("\n========================================");
  console.log("  步骤 2：修复产品和变体 SKU");
  console.log("========================================\n");

  // 收集所有现有 SKU，用于唯一性检查
  const allProducts = await prisma.product.findMany({
    select: { id: true, slug: true, sku: true, content: true },
  });
  const allVariants = await prisma.productVariant.findMany({
    select: { id: true, productId: true, sku: true },
  });

  // 已用 SKU 集合（包括不需要修改的）
  const usedSkus = new Set<string>();
  for (const p of allProducts) usedSkus.add(p.sku);
  for (const v of allVariants) usedSkus.add(v.sku);

  /**
   * 确保 SKU 唯一：如果已存在，追加 -2, -3 ...
   * 注意：先从 usedSkus 中移除旧 SKU，再检查新 SKU
   */
  function ensureUnique(desired: string, oldSku: string): string {
    // 临时移除旧的 SKU，这样如果新 SKU 和旧的一样就不会冲突
    usedSkus.delete(oldSku);

    let candidate = desired;
    let suffix = 2;
    while (usedSkus.has(candidate)) {
      candidate = `${desired}-${suffix}`;
      suffix++;
    }
    usedSkus.add(candidate);
    return candidate;
  }

  // --- 修复产品 SKU ---
  const productsToFix = allProducts.filter((p) => p.sku.startsWith("WC-"));
  console.log(`  发现 ${productsToFix.length} 个产品 SKU 需要修复 (以 "WC-" 开头)\n`);

  // 建立 productId → productName 映射，给变体修复使用
  const productNameMap = new Map<string, string>();
  for (const p of allProducts) {
    const content = p.content as Record<string, any>;
    const name = content?.es?.name || content?.en?.name || p.slug;
    productNameMap.set(p.id, name);
  }

  for (const product of productsToFix) {
    const content = product.content as Record<string, any>;
    const name = content?.es?.name || content?.en?.name || product.slug;

    const extracted = extractModelSku(name, product.slug, product.sku);
    const newSku = ensureUnique(extracted, product.sku);

    console.log(`    [产品] "${product.sku}" → "${newSku}"  (${name})`);

    if (!DRY_RUN) {
      await prisma.product.update({
        where: { id: product.id },
        data: { sku: newSku },
      });
    }
    stats.productSkusFixed++;
  }

  // --- 修复变体 SKU ---
  // 变体 SKU 可能是 "WC-slug" 或 "slug-var-123" 格式
  const variantsToFix = allVariants.filter(
    (v) => v.sku.startsWith("WC-") || v.sku.includes("-var-")
  );
  console.log(`\n  发现 ${variantsToFix.length} 个变体 SKU 需要修复\n`);

  for (const variant of variantsToFix) {
    const productName = productNameMap.get(variant.productId) || "";

    // 对变体，先找到其所属产品的新 SKU 作为基础
    const parentProduct = allProducts.find((p) => p.id === variant.productId);
    const parentSku = parentProduct?.sku || "";

    // 从变体 SKU 中尝试提取有意义的后缀
    let newVariantSku: string;

    if (variant.sku.startsWith("WC-")) {
      // 和产品一样的逻辑
      const extracted = extractModelSku(productName, variant.sku.replace(/^WC-/, ""), variant.sku);
      newVariantSku = ensureUnique(extracted, variant.sku);
    } else if (variant.sku.includes("-var-")) {
      // slug-var-12345 格式：用父产品 SKU + 变体序号
      const varNum = variant.sku.split("-var-").pop() || "";
      const base = parentSku.startsWith("WC-")
        ? extractModelSku(productName, parentSku.replace(/^WC-/, ""), parentSku)
        : parentSku;
      const desired = `${base}-V${varNum}`;
      newVariantSku = ensureUnique(desired, variant.sku);
    } else {
      continue; // 不需要修复
    }

    console.log(`    [变体] "${variant.sku}" → "${newVariantSku}"`);

    if (!DRY_RUN) {
      await prisma.productVariant.update({
        where: { id: variant.id },
        data: { sku: newVariantSku },
      });
    }
    stats.variantSkusFixed++;
  }

  console.log(`\n  SKU 修复完成: 产品 ${stats.productSkusFixed}, 变体 ${stats.variantSkusFixed}`);
}

// ==================== 步骤 3：下载图片并上传到 Supabase ====================

/**
 * 从 WooCommerce API 重新获取产品图片 URL，下载并上传到 Supabase Storage，
 * 然后更新数据库中 content.images 为 Supabase 的公开 URL。
 *
 * 对分类图片也执行同样的操作。
 */
async function fixImages(): Promise<void> {
  console.log("\n========================================");
  console.log("  步骤 3：下载图片并上传到 Supabase Storage");
  console.log("========================================\n");

  if (!WC_URL || !WC_KEY || !WC_SECRET) {
    console.log("  跳过：缺少 WooCommerce API 配置");
    return;
  }

  const supabase = getSupabase();

  // 确保 bucket 存在
  console.log("  检查 Supabase Storage bucket...");
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === SUPABASE_BUCKET);
  if (!bucketExists && !DRY_RUN) {
    const { error } = await supabase.storage.createBucket(SUPABASE_BUCKET, { public: true });
    if (error) {
      console.warn(`  创建 bucket 失败: ${error.message}`);
    } else {
      console.log(`  已创建 bucket: ${SUPABASE_BUCKET}`);
    }
  }

  // --- 产品图片 ---
  console.log("\n  === 产品图片 ===\n");

  // 从数据库获取所有产品
  const dbProducts = await prisma.product.findMany({
    select: { id: true, slug: true, content: true },
  });

  // 从 WooCommerce 获取所有产品（含图片 URL）
  console.log("  从 WooCommerce API 获取产品列表（含图片）...");
  const wcProducts = await fetchAllPages<WCProduct>("products");
  console.log(`  WC 共 ${wcProducts.length} 个产品\n`);

  // 建立 slug → WC产品 映射
  const wcProductMap = new Map<string, WCProduct>();
  for (const wc of wcProducts) {
    wcProductMap.set(wc.slug, wc);
  }

  for (const dbProduct of dbProducts) {
    const content = dbProduct.content as Record<string, any>;
    const currentImages: string[] = content?.images || [];

    // 检查是否需要处理：
    //   - 没有图片
    //   - 图片是 WooCommerce 外链（包含 wp-content/uploads）
    const needsFix =
      currentImages.length === 0 ||
      currentImages.some((url: string) => url.includes("wp-content/uploads") || url.includes(".woocommerce"));

    if (!needsFix) {
      continue; // 图片已经是 Supabase URL，跳过
    }

    // 从 WC API 获取图片
    const wcProduct = wcProductMap.get(dbProduct.slug);
    if (!wcProduct || !wcProduct.images || wcProduct.images.length === 0) {
      continue; // WC 中也没有图片
    }

    console.log(`  处理产品: ${dbProduct.slug} (${wcProduct.images.length} 张图片)`);

    const newImageUrls: string[] = [];

    for (let i = 0; i < wcProduct.images.length; i++) {
      const img = wcProduct.images[i];
      const ext = getExtFromUrl(img.src);
      const filename = `${i === 0 ? "main" : `gallery-${i}`}-${shortHash(img.src)}${ext}`;
      const storagePath = `products/${dbProduct.slug}/${filename}`;

      if (DRY_RUN) {
        console.log(`    [DRY RUN] 将下载: ${img.src}`);
        console.log(`    [DRY RUN] 上传到: ${storagePath}`);
        newImageUrls.push(`[PREVIEW] ${storagePath}`);
        stats.imagesSkipped++;
      } else {
        const publicUrl = await downloadAndUpload(img.src, storagePath, supabase);
        if (publicUrl) {
          newImageUrls.push(publicUrl);
          console.log(`    已上传: ${filename}`);
        } else {
          // 上传失败，保留原始 URL 作为备用
          newImageUrls.push(img.src);
        }
        await delay(200); // 避免请求过快
      }
    }

    // 更新数据库
    if (newImageUrls.length > 0 && !DRY_RUN) {
      content.images = newImageUrls;
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { content: content as Prisma.InputJsonValue },
      });
    }
    stats.productsImageFixed++;
  }

  // --- 分类图片 ---
  console.log("\n  === 分类图片 ===\n");

  const dbCategories = await prisma.category.findMany({
    select: { id: true, slug: true, content: true },
  });

  // 从 WC 获取分类（含图片）
  console.log("  从 WooCommerce API 获取分类列表...");
  const wcCategories = await fetchAllPages<WCCategory>("products/categories");
  console.log(`  WC 共 ${wcCategories.length} 个分类\n`);

  const wcCatMap = new Map<string, WCCategory>();
  for (const wc of wcCategories) {
    wcCatMap.set(wc.slug, wc);
  }

  for (const dbCat of dbCategories) {
    const content = dbCat.content as Record<string, any>;
    const currentImageUrl = content?.imageUrl || "";

    // 检查是否需要处理
    const needsFix =
      !currentImageUrl ||
      currentImageUrl.includes("wp-content/uploads") ||
      currentImageUrl.includes(".woocommerce");

    if (!needsFix) continue;

    const wcCat = wcCatMap.get(dbCat.slug);
    if (!wcCat?.image?.src) continue;

    console.log(`  处理分类: ${dbCat.slug}`);

    const ext = getExtFromUrl(wcCat.image.src);
    const storagePath = `categories/${dbCat.slug}${ext}`;

    if (DRY_RUN) {
      console.log(`    [DRY RUN] 将下载: ${wcCat.image.src}`);
      stats.imagesSkipped++;
    } else {
      const publicUrl = await downloadAndUpload(wcCat.image.src, storagePath, supabase);
      if (publicUrl) {
        content.imageUrl = publicUrl;
        await prisma.category.update({
          where: { id: dbCat.id },
          data: { content: content as Prisma.InputJsonValue },
        });
        console.log(`    已上传: ${storagePath}`);
      }
    }
    stats.categoriesImageFixed++;
  }

  console.log(`\n  图片处理完成: 下载 ${stats.imagesDownloaded}, 跳过 ${stats.imagesSkipped}, 失败 ${stats.imagesFailed}`);
  console.log(`  更新产品 ${stats.productsImageFixed} 个, 分类 ${stats.categoriesImageFixed} 个`);
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     WooCommerce 导入数据修复脚本                      ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  模式:        ${DRY_RUN ? "预览模式 (不写入数据库)" : "正式修复模式"}`);
  console.log(`  图片处理:    ${SKIP_IMAGES ? "跳过" : IMAGES_ONLY ? "仅图片" : "包含"}`);
  console.log();

  const startTime = Date.now();

  if (!IMAGES_ONLY) {
    // 步骤 1：修复 locale 内容
    await fixLocaleContent();

    // 步骤 2 & 4：修复产品和变体 SKU
    await fixSkus();
  }

  if (!SKIP_IMAGES) {
    // 步骤 3：下载并上传图片
    await fixImages();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ==================== 汇总报告 ====================

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                   修复完成报告                         ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  总耗时:          ${elapsed} 秒`);
  console.log(`║  模式:            ${DRY_RUN ? "预览模式" : "正式修复"}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  Locale 修复 (es → en)");
  console.log(`║    产品:          ${stats.productsLocaleFixed}`);
  console.log(`║    分类:          ${stats.categoriesLocaleFixed}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  SKU 修复");
  console.log(`║    产品 SKU:      ${stats.productSkusFixed}`);
  console.log(`║    变体 SKU:      ${stats.variantSkusFixed}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  图片处理");
  console.log(`║    下载上传:      ${stats.imagesDownloaded}`);
  console.log(`║    已存在跳过:    ${stats.imagesSkipped}`);
  console.log(`║    失败:          ${stats.imagesFailed}`);
  console.log(`║    更新产品数:    ${stats.productsImageFixed}`);
  console.log(`║    更新分类数:    ${stats.categoriesImageFixed}`);
  console.log("╠════════════════════════════════════════════════════════╣");

  if (stats.errors.length > 0) {
    console.log(`║  错误 (${stats.errors.length} 个):`);
    for (const err of stats.errors) {
      console.log(`║    - ${err.item}`);
      console.log(`║      ${err.error.slice(0, 80)}`);
    }
  } else {
    console.log("║  无错误");
  }

  console.log("╚════════════════════════════════════════════════════════╝\n");

  if (DRY_RUN) {
    console.log("  这是预览模式，没有写入任何数据。去掉 --dry-run 参数以执行实际修复。\n");
  }
}

// ==================== 执行 ====================

main()
  .catch((err) => {
    console.error("\n致命错误:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
