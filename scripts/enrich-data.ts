/**
 * 数据充实脚本：仓库初始化 + 规格提取 + PDF 文档迁移
 *
 * 功能：
 *   1. 创建默认仓库 + 为所有变体创建 WarehouseStock 记录
 *   2. 从产品描述 HTML 中提取技术规格到 variant.specs
 *   3. 下载产品描述中的 PDF 文件并上传到 Supabase Storage
 *
 * 用法：
 *   npx tsx scripts/enrich-data.ts [--dry-run] [--skip-warehouse] [--skip-specs] [--skip-pdfs]
 *                                   [--specs-only] [--pdfs-only]
 *
 * 前置条件：
 *   - .env 里已配好 DIRECT_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Supabase 已创建 "public-files" bucket
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ── CLI 参数解析 ────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_WAREHOUSE = args.includes("--skip-warehouse");
const SKIP_SPECS = args.includes("--skip-specs");
const SKIP_PDFS = args.includes("--skip-pdfs");
const SPECS_ONLY = args.includes("--specs-only");
const PDFS_ONLY = args.includes("--pdfs-only");

// ── 初始化 ──────────────────────────────────────────────────
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
let supabase: SupabaseClient | null = null;

const BUCKET = "public-files";

// ── 统计 ────────────────────────────────────────────────────
const stats = {
  warehouseCreated: false,
  stockCreated: 0,
  stockSkipped: 0,
  specsExtracted: 0,
  specsSkipped: 0,
  pdfsDownloaded: 0,
  pdfsSkipped: 0,
  pdfsError: 0,
  errors: [] as string[],
};

// ── 类型定义 ────────────────────────────────────────────────
interface ProductContent {
  es?: {
    name?: string;
    description?: string;
    seoTitle?: string;
    seoDescription?: string;
  };
  en?: {
    name?: string;
    description?: string;
  };
  images?: string[];
  documents?: string[];
  [key: string]: unknown;
}

interface SpecsMap {
  [key: string]: string;
}

// ══════════════════════════════════════════════════════════════
// STEP 1: 仓库 + 库存初始化
// ══════════════════════════════════════════════════════════════

async function initWarehouseAndStock(): Promise<void> {
  console.log("\n══════════════════════════════════════════");
  console.log("  步骤 1: 仓库 + 库存初始化");
  console.log("══════════════════════════════════════════\n");

  // 1a. 创建默认仓库
  let warehouse = await prisma.warehouse.findFirst({
    where: { code: "WH-MADRID" },
  });

  if (!warehouse) {
    if (DRY_RUN) {
      console.log("[预览] 将创建仓库: Almacén Madrid (WH-MADRID)");
      stats.warehouseCreated = true;
    } else {
      warehouse = await prisma.warehouse.create({
        data: {
          name: "Almacén Madrid",
          code: "WH-MADRID",
          address: "Madrid, España",
          country: "ES",
          isDefault: true,
          isActive: true,
        },
      });
      console.log(`✓ 仓库已创建: ${warehouse.name} (${warehouse.id})`);
      stats.warehouseCreated = true;
    }
  } else {
    console.log(`  仓库已存在: ${warehouse.name} (${warehouse.id})`);
  }

  const warehouseId = warehouse?.id;
  if (!warehouseId && !DRY_RUN) {
    console.error("  ✗ 无法获取仓库 ID，跳过库存初始化");
    return;
  }

  // 1b. 为所有变体创建 WarehouseStock
  const variants = await prisma.productVariant.findMany({
    select: { id: true, sku: true, physicalStock: true },
  });

  console.log(`\n  找到 ${variants.length} 个产品变体`);

  // 获取已存在的 WarehouseStock
  const existingStocks = warehouseId
    ? await prisma.warehouseStock.findMany({
        where: { warehouseId },
        select: { variantId: true },
      })
    : [];
  const existingVariantIds = new Set(existingStocks.map((s) => s.variantId));

  const toCreate = variants.filter((v) => !existingVariantIds.has(v.id));
  stats.stockSkipped = variants.length - toCreate.length;

  if (toCreate.length === 0) {
    console.log("  所有变体已有库存记录，跳过");
    return;
  }

  console.log(`  需要创建: ${toCreate.length} 条库存记录 (已跳过: ${stats.stockSkipped})`);

  if (DRY_RUN) {
    for (const v of toCreate.slice(0, 5)) {
      console.log(`  [预览] ${v.sku}: physicalStock=${v.physicalStock}`);
    }
    if (toCreate.length > 5) console.log(`  ... 还有 ${toCreate.length - 5} 条`);
    stats.stockCreated = toCreate.length;
    return;
  }

  // 批量创建
  const batchSize = 100;
  for (let i = 0; i < toCreate.length; i += batchSize) {
    const batch = toCreate.slice(i, i + batchSize);
    await prisma.warehouseStock.createMany({
      data: batch.map((v) => ({
        warehouseId: warehouseId!,
        variantId: v.id,
        physicalStock: v.physicalStock,
        allocatedStock: 0,
        minStock: 0,
      })),
      skipDuplicates: true,
    });
    stats.stockCreated += batch.length;
    console.log(`  已创建: ${Math.min(i + batchSize, toCreate.length)}/${toCreate.length}`);
  }

  console.log(`\n  ✓ 库存初始化完成: 创建 ${stats.stockCreated} 条`);
}

// ══════════════════════════════════════════════════════════════
// STEP 2: 从 HTML 描述中提取规格
// ══════════════════════════════════════════════════════════════

/**
 * 规格关键词映射（不区分大小写）
 */
const SPEC_PATTERNS: Array<{ keys: RegExp; field: string }> = [
  {
    keys: /^(potencia|potenica|power|wattage|watts?)$/i,
    field: "power",
  },
  {
    keys: /^(temperatura\s*de\s*la?\s*luz|color\s*de\s*la?\s*luz|cct|temperatura\s*color|color\s*temperature|colore?s?)$/i,
    field: "cct",
  },
  {
    keys: /^(ip\s*\d*|grado\s*de\s*protecci[oó]n|protecci[oó]n|proteccion)$/i,
    field: "ip",
  },
  {
    keys: /^(tensi[oó]n|tensi[oó]n\s*de\s*trabajo|tesion|voltage|voltaje|alimentaci[oó]n)$/i,
    field: "voltage",
  },
  {
    keys: /^(input|input\s*voltage|entrada)$/i,
    field: "input",
  },
  {
    keys: /^(output|salida)$/i,
    field: "output",
  },
  {
    keys: /^(medidas?|dimensi[oó]ne?s?|tama[nñ]o|size|di[aá]metro|ancho|altura)$/i,
    field: "dimensions",
  },
  {
    keys: /^(garant[ií]a|grantia|gariantia|warranty)$/i,
    field: "warranty",
  },
  {
    keys: /^(bean\s*angle|beam\s*angle|[aá]ngulo|[aá]ngulo\s*de\s*apertura|angle)$/i,
    field: "beam_angle",
  },
  {
    keys: /^(brillo|lumen|l[uú]menes?|lumens?|flujo\s*luminoso|luminous|luminous\s*flux)$/i,
    field: "lumen",
  },
  {
    keys: /^(cri|[ií]ndice\s*de\s*reproducci[oó]n|ra|irc)$/i,
    field: "cri",
  },
  {
    keys: /^(material|materiale?s?)$/i,
    field: "material",
  },
  {
    keys: /^(corte|[aá]rea\s*de\s*corte)$/i,
    field: "cut_size",
  },
  {
    keys: /^(peso|weight)$/i,
    field: "weight",
  },
  {
    keys: /^(temporizador|timer)$/i,
    field: "timer",
  },
  {
    keys: /^(velocidades?|speeds?|fan\s*speed)$/i,
    field: "fan_speed",
  },
  {
    keys: /^([aá]rea\s*de\s*trabajo|cobertura|coverage|area)$/i,
    field: "coverage_area",
  },
  {
    keys: /^(modos?|modes?)$/i,
    field: "modes",
  },
  {
    keys: /^(bombillas?|bulb|tipo\s*de\s*bombilla|l[aá]mpara)$/i,
    field: "bulb_type",
  },
  {
    keys: /^(bater[ií]a|battery|capacidad)$/i,
    field: "battery",
  },
  {
    keys: /^(driver|controlador)$/i,
    field: "driver",
  },
  {
    keys: /^(distancia|distance|alcance)$/i,
    field: "range",
  },
  {
    keys: /^(vida\s*[uú]til|life|lifespan|duraci[oó]n)$/i,
    field: "lifespan",
  },
  {
    keys: /^(tiempo\s*de\s*carga|charging\s*time)$/i,
    field: "charging_time",
  },
  {
    keys: /^(tiempo\s*de\s*trabajo|tiempo\s*de\s*iluminaci[oó]n|working\s*time|run\s*time)$/i,
    field: "working_time",
  },
];

function normalizeSpecKey(rawKey: string): string | null {
  const trimmed = rawKey.trim();
  for (const pattern of SPEC_PATTERNS) {
    if (pattern.keys.test(trimmed)) {
      return pattern.field;
    }
  }
  return null;
}

function extractSpecsFromHtml(html: string): SpecsMap {
  const specs: SpecsMap = {};

  // Pattern 1: <strong>Key:</strong> Value  or  <strong>Key</strong> Value
  // Handles optional colon after the key text or after </strong>
  const strongPattern = /<strong>\s*([^<]+?)\s*:?\s*<\/strong>\s*:?\s*([^<]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = strongPattern.exec(html)) !== null) {
    const rawKey = match[1].trim().replace(/:$/, "");
    const rawValue = match[2].trim();
    if (!rawValue || rawValue.length > 200) continue;

    const field = normalizeSpecKey(rawKey);
    if (field && rawValue) {
      specs[field] = rawValue;
    } else if (rawValue && rawKey.length >= 2 && rawKey.length <= 40) {
      // Fallback: convert unknown keys to snake_case and include them
      const fallbackKey = rawKey
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      if (fallbackKey && fallbackKey.length >= 2) {
        specs[fallbackKey] = rawValue;
      }
    }
  }

  // Pattern 2: <p>KEY:VALUE</p> or <p>KEY VALUE</p> without <strong> tags
  // e.g. <p>BOMBILLA:E27</p>, <p>MEDIDA:1.5M</p>, <p>GARANTIA 2AÑOS</p>
  const plainPattern = /<p[^>]*>\s*([A-ZÁÉÍÓÚÑa-záéíóúñ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{1,35}?)[:：]\s*(.+?)\s*<\/p>/gi;
  while ((match = plainPattern.exec(html)) !== null) {
    const rawKey = match[1].trim();
    const rawValue = match[2].trim().replace(/<[^>]*>/g, "").trim();
    if (!rawValue || rawValue.length > 200) continue;
    // Skip if it looks like a sentence (has too many words) or is a product name/link
    if (rawValue.includes("<a ") || rawKey.split(/\s+/).length > 4) continue;

    const field = normalizeSpecKey(rawKey);
    if (field) {
      if (!specs[field]) specs[field] = rawValue;
    } else if (rawKey.length >= 2 && rawKey.length <= 35) {
      const fallbackKey = rawKey
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .trim()
        .replace(/\s+/g, "_");
      if (fallbackKey && fallbackKey.length >= 2 && !specs[fallbackKey]) {
        specs[fallbackKey] = rawValue;
      }
    }
  }

  // Pattern 2b: <p>KEY VALUE</p> without colon (e.g. <p>GARANTIA 2AÑOS</p>)
  // Only match known keys to avoid false positives
  const plainNoColonPattern = /<p[^>]*>\s*(GARANTIA|GRANTIA|IP\d{2,3}|POTENCIA|POTENICA)\s+(.+?)\s*<\/p>/gi;
  while ((match = plainNoColonPattern.exec(html)) !== null) {
    const rawKey = match[1].trim();
    const rawValue = match[2].trim().replace(/<[^>]*>/g, "").trim();
    if (!rawValue) continue;
    const field = normalizeSpecKey(rawKey);
    if (field && !specs[field]) {
      specs[field] = rawValue;
    }
  }

  // Pattern 3: standalone IP rating like <p>IP65</p> or <p>IP20</p>
  const ipStandalone = /<p>\s*(IP\d{2,3})\s*<\/p>/gi;
  while ((match = ipStandalone.exec(html)) !== null) {
    if (!specs.ip) {
      specs.ip = match[1].toUpperCase();
    }
  }

  // Pattern 3: standalone text that looks like a spec value without a key
  // e.g., <li>IP65</li>
  const ipLiPattern = /<li>\s*(IP\d{2,3})\s*<\/li>/gi;
  while ((match = ipLiPattern.exec(html)) !== null) {
    if (!specs.ip) {
      specs.ip = match[1].toUpperCase();
    }
  }

  return specs;
}

async function extractAndUpdateSpecs(): Promise<void> {
  console.log("\n══════════════════════════════════════════");
  console.log("  步骤 2: 从描述中提取技术规格");
  console.log("══════════════════════════════════════════\n");

  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      content: true,
      variants: {
        select: { id: true, sku: true, specs: true },
      },
    },
  });

  console.log(`  找到 ${products.length} 个产品\n`);

  for (const product of products) {
    const content = product.content as ProductContent;
    const description = content?.es?.description;

    if (!description) {
      stats.specsSkipped++;
      continue;
    }

    const extractedSpecs = extractSpecsFromHtml(description);

    if (Object.keys(extractedSpecs).length === 0) {
      stats.specsSkipped++;
      continue;
    }

    const productName = content?.es?.name || product.slug;
    console.log(`  [${productName}] 提取到: ${JSON.stringify(extractedSpecs)}`);

    for (const variant of product.variants) {
      const existingSpecs = (variant.specs as SpecsMap) || {};
      const mergedSpecs: SpecsMap = { ...extractedSpecs };

      // Existing specs take priority (don't overwrite)
      for (const [key, value] of Object.entries(existingSpecs)) {
        if (value && String(value).trim()) {
          mergedSpecs[key] = String(value);
        }
      }

      // Check if anything actually changed
      const hasNewSpecs = Object.keys(mergedSpecs).some(
        (k) => !existingSpecs[k] || existingSpecs[k] !== mergedSpecs[k]
      );

      if (!hasNewSpecs) continue;

      if (DRY_RUN) {
        console.log(`    [预览] ${variant.sku}: ${JSON.stringify(mergedSpecs)}`);
      } else {
        await prisma.productVariant.update({
          where: { id: variant.id },
          data: { specs: mergedSpecs },
        });
      }
      stats.specsExtracted++;
    }
  }

  console.log(`\n  ✓ 规格提取完成: 更新 ${stats.specsExtracted} 个变体, 跳过 ${stats.specsSkipped} 个产品`);
}

// ══════════════════════════════════════════════════════════════
// STEP 3: 下载 PDF 并上传到 Supabase
// ══════════════════════════════════════════════════════════════

interface PdfLink {
  url: string;
  filename: string;
  text: string;
}

function extractPdfLinks(html: string): PdfLink[] {
  const links: PdfLink[] = [];
  // Match <a href="...pdf"> tags
  const pattern = /<a\s+[^>]*href\s*=\s*["']([^"']+\.pdf)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].trim();
    const text = match[2].replace(/<[^>]*>/g, "").trim();

    // Extract filename from URL
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1];

    if (filename) {
      links.push({ url, filename: decodeURIComponent(filename), text });
    }
  }

  return links;
}

async function downloadPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LEDErpBot/1.0)",
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      console.log(`    ✗ 下载失败 (${response.status}): ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.log(`    ✗ 下载出错: ${url} - ${(err as Error).message}`);
    return null;
  }
}

async function uploadToSupabase(
  sb: SupabaseClient,
  filePath: string,
  data: Buffer
): Promise<string | null> {
  const { error } = await sb.storage.from(BUCKET).upload(filePath, data, {
    contentType: "application/pdf",
    upsert: true,
  });

  if (error) {
    console.log(`    ✗ 上传失败: ${filePath} - ${error.message}`);
    return null;
  }

  const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

async function downloadAndMigratePdfs(): Promise<void> {
  console.log("\n══════════════════════════════════════════");
  console.log("  步骤 3: 下载 PDF 文档并上传到 Supabase");
  console.log("══════════════════════════════════════════\n");

  if (!supabaseUrl || !supabaseKey) {
    console.error("  ✗ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY，跳过 PDF 迁移");
    return;
  }

  supabase = createClient(supabaseUrl, supabaseKey);

  const products = await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      content: true,
    },
  });

  console.log(`  找到 ${products.length} 个产品\n`);

  for (const product of products) {
    const content = product.content as ProductContent;
    const description = content?.es?.description;

    if (!description) continue;

    const pdfLinks = extractPdfLinks(description);
    if (pdfLinks.length === 0) continue;

    const productName = content?.es?.name || product.slug;
    console.log(`  [${productName}] 找到 ${pdfLinks.length} 个 PDF 链接`);

    const documents: string[] = (content.documents as string[]) || [];
    let descriptionUpdated = description;
    let hasChanges = false;

    for (const pdf of pdfLinks) {
      console.log(`    → ${pdf.filename}`);

      if (DRY_RUN) {
        console.log(`      [预览] 将下载: ${pdf.url}`);
        console.log(`      [预览] 将上传到: documents/${product.slug}/${pdf.filename}`);
        stats.pdfsDownloaded++;
        continue;
      }

      // Download PDF
      const pdfData = await downloadPdf(pdf.url);
      if (!pdfData) {
        stats.pdfsError++;
        stats.errors.push(`PDF 下载失败: ${pdf.url} (${productName})`);
        continue;
      }

      // Upload to Supabase
      const storagePath = `documents/${product.slug}/${pdf.filename}`;
      const publicUrl = await uploadToSupabase(supabase!, storagePath, pdfData);

      if (!publicUrl) {
        stats.pdfsError++;
        stats.errors.push(`PDF 上传失败: ${storagePath} (${productName})`);
        continue;
      }

      // Track document URL
      if (!documents.includes(publicUrl)) {
        documents.push(publicUrl);
      }

      // Replace old URL in description
      descriptionUpdated = descriptionUpdated.replace(pdf.url, publicUrl);
      hasChanges = true;
      stats.pdfsDownloaded++;

      console.log(`      ✓ 已上传: ${storagePath}`);
    }

    if (hasChanges && !DRY_RUN) {
      // Update product content with new document URLs and updated description
      const updatedContent: ProductContent = {
        ...content,
        documents,
        es: {
          ...content.es,
          description: descriptionUpdated,
        },
      };

      await prisma.product.update({
        where: { id: product.id },
        data: { content: updatedContent },
      });

      console.log(`    ✓ 产品内容已更新 (${documents.length} 个文档)`);
    }
  }

  console.log(
    `\n  ✓ PDF 迁移完成: 下载 ${stats.pdfsDownloaded} 个, 失败 ${stats.pdfsError} 个, 跳过 ${stats.pdfsSkipped} 个`
  );
}

// ══════════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║        数据充实脚本 - Leader Madrid       ║");
  console.log("╚══════════════════════════════════════════╝");

  if (DRY_RUN) {
    console.log("\n⚠ 预览模式 (--dry-run)：不会实际修改数据\n");
  }

  const flags = [];
  if (SKIP_WAREHOUSE) flags.push("skip-warehouse");
  if (SKIP_SPECS) flags.push("skip-specs");
  if (SKIP_PDFS) flags.push("skip-pdfs");
  if (SPECS_ONLY) flags.push("specs-only");
  if (PDFS_ONLY) flags.push("pdfs-only");
  if (flags.length > 0) console.log(`  选项: ${flags.join(", ")}\n`);

  try {
    // Determine which steps to run
    const runWarehouse = SPECS_ONLY || PDFS_ONLY ? false : !SKIP_WAREHOUSE;
    const runSpecs = PDFS_ONLY ? false : SPECS_ONLY || !SKIP_SPECS;
    const runPdfs = SPECS_ONLY ? false : PDFS_ONLY || !SKIP_PDFS;

    if (runWarehouse) {
      await initWarehouseAndStock();
    } else {
      console.log("\n  ⏭ 跳过仓库初始化");
    }

    if (runSpecs) {
      await extractAndUpdateSpecs();
    } else {
      console.log("\n  ⏭ 跳过规格提取");
    }

    if (runPdfs) {
      await downloadAndMigratePdfs();
    } else {
      console.log("\n  ⏭ 跳过 PDF 迁移");
    }
  } catch (err) {
    console.error("\n  ✗ 脚本执行出错:", err);
    stats.errors.push(`致命错误: ${(err as Error).message}`);
  } finally {
    await prisma.$disconnect();
  }

  // ── 汇总报告 ────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║              执行报告                     ║");
  console.log("╠══════════════════════════════════════════╣");
  console.log(`║  仓库:  ${stats.warehouseCreated ? "已创建" : "已存在/跳过"}`.padEnd(44) + "║");
  console.log(`║  库存:  创建 ${stats.stockCreated}, 跳过 ${stats.stockSkipped}`.padEnd(44) + "║");
  console.log(`║  规格:  更新 ${stats.specsExtracted} 变体, 跳过 ${stats.specsSkipped} 产品`.padEnd(44) + "║");
  console.log(`║  PDF:   下载 ${stats.pdfsDownloaded}, 失败 ${stats.pdfsError}`.padEnd(44) + "║");
  if (stats.errors.length > 0) {
    console.log("╠══════════════════════════════════════════╣");
    console.log("║  错误列表:                                ║");
    for (const e of stats.errors) {
      console.log(`║  - ${e}`.padEnd(44) + "║");
    }
  }
  console.log("╚══════════════════════════════════════════╝");
}

main();
