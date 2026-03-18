/**
 * WooCommerce REST API → My LED ERP 完整数据迁移脚本
 *
 * 功能：
 *   1. 导入分类 (29个) → Category 表
 *   2. 导入产品 (776个) → Product + ProductVariant 表
 *   3. 导入产品属性 → AttributeDefinition + AttributeOption 表
 *   4. 下载图片并上传到 Supabase Storage
 *
 * 用法:
 *   npx tsx scripts/import-woocommerce.ts                         # 全量迁移
 *   npx tsx scripts/import-woocommerce.ts --dry-run               # 仅预览，不写入数据库
 *   npx tsx scripts/import-woocommerce.ts --skip-images           # 跳过图片下载/上传
 *   npx tsx scripts/import-woocommerce.ts --limit=20              # 仅导入前20个产品
 *   npx tsx scripts/import-woocommerce.ts --category-only         # 仅导入分类
 *
 * 特性：
 *   - 幂等性：通过 slug 判断是否已存在，使用 upsert 避免重复
 *   - 速率限制：API 调用间有延迟，避免压垮 WooCommerce
 *   - 错误容忍：单个产品失败不影响整体，最终汇总错误
 *   - 断点续传：已导入的数据不会重复导入
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as crypto from "crypto";

dotenv.config();

// ==================== 配置 ====================

const prisma = new PrismaClient();

const WC_URL = process.env.WOOCOMMERCE_URL!;
const WC_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!;
const WC_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SUPABASE_BUCKET = "public-files";
const IMAGE_UPLOAD_PATH = "products";
const API_DELAY_MS = 500; // API 调用间隔（毫秒）

// ==================== 命令行参数解析 ====================

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const SKIP_IMAGES = args.includes("--skip-images");
const CATEGORY_ONLY = args.includes("--category-only");
const LIMIT = (() => {
  const limitArg = args.find((a) => a.startsWith("--limit="));
  return limitArg ? parseInt(limitArg.split("=")[1], 10) : 0;
})();

// ==================== 统计计数器 ====================

const stats = {
  categoriesCreated: 0,
  categoriesUpdated: 0,
  categoriesSkipped: 0,
  productsCreated: 0,
  productsUpdated: 0,
  productsSkipped: 0,
  variantsCreated: 0,
  variantsUpdated: 0,
  imagesUploaded: 0,
  imagesSkipped: 0,
  imagesFailed: 0,
  attributesCreated: 0,
  attributeOptionsCreated: 0,
  errors: [] as { item: string; error: string }[],
};

// ==================== WooCommerce 类型定义 ====================

interface WCCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: string;
  image: { id: number; src: string; name: string; alt: string } | null;
  count: number;
}

interface WCImage {
  id: number;
  src: string;
  name: string;
  alt: string;
}

interface WCAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

interface WCDimensions {
  length: string;
  width: string;
  height: string;
}

interface WCProduct {
  id: number;
  name: string;
  slug: string;
  type: "simple" | "variable" | "grouped" | "external";
  status: "publish" | "draft" | "pending" | "private";
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  stock_quantity: number | null;
  weight: string;
  dimensions: WCDimensions;
  categories: { id: number; name: string; slug: string }[];
  images: WCImage[];
  attributes: WCAttribute[];
  variations: number[];
}

interface WCVariation {
  id: number;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  stock_quantity: number | null;
  weight: string;
  dimensions: WCDimensions;
  image: WCImage | null;
  attributes: { id: number; name: string; option: string }[];
}

// ==================== 属性映射（复用 migrate-ledme.ts 中的映射） ====================

const ATTRIBUTE_MAP: Record<string, {
  key: string;
  nameEn: string;
  nameEs: string;
  type: "SELECT" | "TEXT" | "NUMBER";
  unit?: string;
  scope: "PRODUCT" | "VARIANT";
}> = {
  "Vatios": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Potencia": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Potencia Máxima": { key: "power", nameEn: "Power", nameEs: "Potencia", type: "SELECT", unit: "W", scope: "VARIANT" },
  "Fuente Lumínica": { key: "lightSource", nameEn: "Light Source", nameEs: "Fuente Lumínica", type: "SELECT", scope: "PRODUCT" },
  "Acabado": { key: "finish", nameEn: "Finish", nameEs: "Acabado", type: "SELECT", scope: "PRODUCT" },
  "Luminosidad": { key: "lumens", nameEn: "Luminous Flux", nameEs: "Luminosidad", type: "NUMBER", unit: "lm", scope: "VARIANT" },
  "Flujo luminoso": { key: "lumens", nameEn: "Luminous Flux", nameEs: "Luminosidad", type: "NUMBER", unit: "lm", scope: "VARIANT" },
  "Eficiencia Lm": { key: "luminousEfficiency", nameEn: "Luminous Efficiency", nameEs: "Eficiencia Luminosa", type: "NUMBER", unit: "lm/W", scope: "VARIANT" },
  "Temperatura De Trabajo": { key: "operatingTemp", nameEn: "Operating Temperature", nameEs: "Temperatura de Trabajo", type: "TEXT", scope: "PRODUCT" },
  "Ángulo": { key: "beamAngle", nameEn: "Beam Angle", nameEs: "Ángulo de Apertura", type: "SELECT", unit: "°", scope: "VARIANT" },
  "Ángulo de apertura": { key: "beamAngle", nameEn: "Beam Angle", nameEs: "Ángulo de Apertura", type: "SELECT", unit: "°", scope: "VARIANT" },
  "Vida Útil": { key: "lifespan", nameEn: "Lifespan", nameEs: "Vida Útil", type: "NUMBER", unit: "h", scope: "PRODUCT" },
  "Protección": { key: "ip", nameEn: "IP Rating", nameEs: "Protección IP", type: "SELECT", scope: "VARIANT" },
  "Clase Aislamiento Eléctrico": { key: "electricClass", nameEn: "Electric Class", nameEs: "Clase Eléctrica", type: "SELECT", scope: "PRODUCT" },
  "Alimentación": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Tensión de Entrada": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Tensión": { key: "voltage", nameEn: "Voltage", nameEs: "Voltaje", type: "TEXT", scope: "PRODUCT" },
  "Dimensión": { key: "dimensions", nameEn: "Dimensions", nameEs: "Dimensiones", type: "TEXT", scope: "PRODUCT" },
  "Material": { key: "material", nameEn: "Material", nameEs: "Material", type: "SELECT", scope: "PRODUCT" },
  "Cri": { key: "cri", nameEn: "CRI", nameEs: "CRI", type: "SELECT", scope: "VARIANT" },
  "CRI": { key: "cri", nameEn: "CRI", nameEs: "CRI", type: "SELECT", scope: "VARIANT" },
  "Garantía": { key: "warranty", nameEn: "Warranty", nameEs: "Garantía", type: "SELECT", unit: "years", scope: "PRODUCT" },
  "Temperatura De Color": { key: "cct", nameEn: "Color Temperature", nameEs: "Temperatura de Color", type: "SELECT", unit: "K", scope: "VARIANT" },
  "Temperatura de Color": { key: "cct", nameEn: "Color Temperature", nameEs: "Temperatura de Color", type: "SELECT", unit: "K", scope: "VARIANT" },
  "Regulable": { key: "dimmable", nameEn: "Dimmable", nameEs: "Regulable", type: "SELECT", scope: "VARIANT" },
  "Dimmable": { key: "dimmable", nameEn: "Dimmable", nameEs: "Regulable", type: "SELECT", scope: "VARIANT" },
  "Casquillo": { key: "base", nameEn: "Base/Socket", nameEs: "Casquillo", type: "SELECT", scope: "PRODUCT" },
  "Socket": { key: "base", nameEn: "Base/Socket", nameEs: "Casquillo", type: "SELECT", scope: "PRODUCT" },
  "Peso": { key: "weight", nameEn: "Weight", nameEs: "Peso", type: "TEXT", unit: "kg", scope: "PRODUCT" },
  "Factor de Potencia": { key: "powerFactor", nameEn: "Power Factor", nameEs: "Factor de Potencia", type: "TEXT", scope: "PRODUCT" },
  "Frecuencia": { key: "frequency", nameEn: "Frequency", nameEs: "Frecuencia", type: "TEXT", unit: "Hz", scope: "PRODUCT" },
  "Color de la carcasa": { key: "housingColor", nameEn: "Housing Color", nameEs: "Color Carcasa", type: "SELECT", scope: "PRODUCT" },
  "Forma": { key: "shape", nameEn: "Shape", nameEs: "Forma", type: "SELECT", scope: "PRODUCT" },
  "Color": { key: "color", nameEn: "Color", nameEs: "Color", type: "SELECT", scope: "VARIANT" },
  "Instalación": { key: "installation", nameEn: "Installation", nameEs: "Instalación", type: "SELECT", scope: "PRODUCT" },
  "UGR": { key: "ugr", nameEn: "UGR", nameEs: "UGR", type: "TEXT", scope: "PRODUCT" },
  "Flicker Free": { key: "flickerFree", nameEn: "Flicker Free", nameEs: "Libre de Parpadeo", type: "SELECT", scope: "PRODUCT" },
  "Corte Cada": { key: "cutLength", nameEn: "Cut Length", nameEs: "Corte Cada", type: "TEXT", scope: "VARIANT" },
  "Salida": { key: "output", nameEn: "Output", nameEs: "Salida", type: "TEXT", scope: "PRODUCT" },
  "Driver": { key: "driver", nameEn: "Driver", nameEs: "Driver", type: "TEXT", scope: "PRODUCT" },
  "Ik": { key: "ik", nameEn: "Impact Resistance", nameEs: "Resistencia al Impacto", type: "TEXT", scope: "PRODUCT" },
  "Proteccion Contra Sobretensión": { key: "surgeProtection", nameEn: "Surge Protection", nameEs: "Protección contra Sobretensión", type: "TEXT", scope: "PRODUCT" },
  "Incluye": { key: "includes", nameEn: "Includes", nameEs: "Incluye", type: "TEXT", scope: "PRODUCT" },
  "Sensor": { key: "sensor", nameEn: "Sensor", nameEs: "Sensor", type: "SELECT", scope: "PRODUCT" },
  "Intensidad De Corriente": { key: "current", nameEn: "Current", nameEs: "Intensidad de Corriente", type: "TEXT", unit: "mA", scope: "VARIANT" },
  "Intensidad de Corriente": { key: "current", nameEn: "Current", nameEs: "Intensidad de Corriente", type: "TEXT", unit: "mA", scope: "VARIANT" },
  "Dimensión De Corte": { key: "cutoutSize", nameEn: "Cutout Size", nameEs: "Dimensión de Corte", type: "TEXT", scope: "VARIANT" },
  "Dimensión de Corte": { key: "cutoutSize", nameEn: "Cutout Size", nameEs: "Dimensión de Corte", type: "TEXT", scope: "VARIANT" },
  "LED/m": { key: "ledPerMeter", nameEn: "LED/m", nameEs: "LED/m", type: "NUMBER", scope: "VARIANT" },
  "Led/M": { key: "ledPerMeter", nameEn: "LED/m", nameEs: "LED/m", type: "NUMBER", scope: "VARIANT" },
  "Diámetro De Fijación": { key: "mountingDiameter", nameEn: "Mounting Diameter", nameEs: "Diámetro de Fijación", type: "TEXT", scope: "VARIANT" },
  "Diámetro de Fijación": { key: "mountingDiameter", nameEn: "Mounting Diameter", nameEs: "Diámetro de Fijación", type: "TEXT", scope: "VARIANT" },
  "Longitud De Onda": { key: "wavelength", nameEn: "Wavelength", nameEs: "Longitud de Onda", type: "TEXT", unit: "nm", scope: "VARIANT" },
  "Longitud de Onda": { key: "wavelength", nameEn: "Wavelength", nameEs: "Longitud de Onda", type: "TEXT", unit: "nm", scope: "VARIANT" },
  "Batería": { key: "battery", nameEn: "Battery", nameEs: "Batería", type: "TEXT", scope: "PRODUCT" },
  "Temporizador": { key: "timer", nameEn: "Timer", nameEs: "Temporizador", type: "SELECT", scope: "PRODUCT" },
  "Motor": { key: "motor", nameEn: "Motor", nameEs: "Motor", type: "TEXT", scope: "PRODUCT" },
  "Ruido": { key: "noise", nameEn: "Noise", nameEs: "Ruido", type: "TEXT", unit: "dB", scope: "PRODUCT" },
  "RPM": { key: "rpm", nameEn: "RPM", nameEs: "RPM", type: "NUMBER", scope: "PRODUCT" },
  "Rpm": { key: "rpm", nameEn: "RPM", nameEs: "RPM", type: "NUMBER", scope: "PRODUCT" },
};

// ==================== 工具函数 ====================

/** 延迟指定毫秒 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 从 URL 中提取文件扩展名 */
function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext || ".jpg";
  } catch {
    return ".jpg";
  }
}

/** 生成短哈希用于文件名 */
function shortHash(str: string): string {
  return crypto.createHash("md5").update(str).digest("hex").slice(0, 8);
}

/** 清理 HTML 标签 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** 将西班牙语属性名转换为英文 key */
function resolveAttributeKey(wcName: string): string {
  const mapped = ATTRIBUTE_MAP[wcName];
  if (mapped) return mapped.key;
  // 未映射的属性：转成 snake_case 作为 key
  return wcName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // 去除重音符号
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** 将西班牙语属性名获取映射信息（用于创建 AttributeDefinition） */
function resolveAttributeInfo(wcName: string) {
  const mapped = ATTRIBUTE_MAP[wcName];
  if (mapped) return mapped;
  // 未映射的属性：使用原名作为西班牙语，key 作为英语
  const key = resolveAttributeKey(wcName);
  return {
    key,
    nameEn: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    nameEs: wcName,
    type: "TEXT" as const,
    scope: "PRODUCT" as const,
  };
}

// ==================== WooCommerce API 调用 ====================

/**
 * 调用 WooCommerce REST API v3
 * 使用 query parameter 认证方式
 */
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
    throw new Error(`WooCommerce API 错误 [${res.status}]: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/**
 * 分页获取 WooCommerce 所有数据
 * WC API v3 每页最多 100 条
 */
async function fetchAllPages<T>(
  endpoint: string,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  let page = 1;
  const allItems: T[] = [];

  while (true) {
    console.log(`  📦 获取 ${endpoint} 第 ${page} 页...`);
    const items = await fetchWC<T[]>(endpoint, {
      per_page: "100",
      page: String(page),
      ...extraParams,
    });

    if (!items || items.length === 0) break;
    allItems.push(...items);

    // 如果返回数量不足100，说明已经是最后一页
    if (items.length < 100) break;

    page++;
    await delay(API_DELAY_MS);
  }

  return allItems;
}

// ==================== 图片下载与上传 ====================

/**
 * 下载图片并上传到 Supabase Storage
 * 返回公开 URL，如果失败返回 null
 */
async function downloadAndUploadImage(
  imageUrl: string,
  storagePath: string
): Promise<string | null> {
  if (SKIP_IMAGES || DRY_RUN) {
    console.log(`    🖼️  [跳过] ${imageUrl}`);
    stats.imagesSkipped++;
    return null;
  }

  try {
    // 检查是否已存在（避免重复上传）
    const { data: existingFile } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .list(path.dirname(storagePath).replace(/\\/g, "/"), {
        search: path.basename(storagePath),
      });

    if (existingFile && existingFile.length > 0) {
      const existing = existingFile.find(
        (f) => f.name === path.basename(storagePath)
      );
      if (existing) {
        const { data: urlData } = supabase.storage
          .from(SUPABASE_BUCKET)
          .getPublicUrl(storagePath);
        console.log(`    🖼️  [已存在] ${path.basename(storagePath)}`);
        stats.imagesSkipped++;
        return urlData.publicUrl;
      }
    }

    // 下载图片
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`下载失败 HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 根据 Content-Type 确定文件类型
    const contentType = response.headers.get("content-type") || "image/jpeg";

    // 上传到 Supabase
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`上传失败: ${uploadError.message}`);
    }

    // 获取公开 URL
    const { data: urlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(storagePath);

    console.log(`    🖼️  [上传成功] ${path.basename(storagePath)}`);
    stats.imagesUploaded++;
    return urlData.publicUrl;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`    ❌ 图片处理失败 ${imageUrl}: ${errMsg}`);
    stats.imagesFailed++;
    return null;
  }
}

// ==================== 导入分类 ====================

/**
 * 从 WooCommerce 导入所有产品分类
 * 维护 WC ID → 本地 Category ID 的映射关系
 */
async function importCategories(): Promise<Map<number, string>> {
  console.log("\n========================================");
  console.log("📁 第一步：导入产品分类");
  console.log("========================================\n");

  // WC 分类 ID → 本地 Category ID
  const categoryMap = new Map<number, string>();

  // 获取所有分类
  const wcCategories = await fetchAllPages<WCCategory>("products/categories");
  console.log(`  共获取 ${wcCategories.length} 个分类\n`);

  // 过滤掉 "Uncategorized" 分类 (WC 默认分类)
  const filteredCategories = wcCategories.filter(
    (c) => c.slug !== "uncategorized"
  );

  // 按层级排序：先处理根分类（parent === 0），再处理子分类
  const sortedCategories = filteredCategories.sort((a, b) => {
    if (a.parent === 0 && b.parent !== 0) return -1;
    if (a.parent !== 0 && b.parent === 0) return 1;
    return a.id - b.id;
  });

  for (const wc of sortedCategories) {
    try {
      console.log(`  处理分类: ${wc.name} (WC ID: ${wc.id}, slug: ${wc.slug})`);

      // 构建 content JSON（西班牙语内容）
      const content: Record<string, any> = {
        es: {
          name: stripHtml(wc.name),
        },
      };

      // 如果有描述，添加到 content
      if (wc.description) {
        content.es.description = stripHtml(wc.description);
      }

      // 处理分类图片
      if (wc.image?.src) {
        const ext = getExtFromUrl(wc.image.src);
        const storagePath = `categories/${wc.slug}${ext}`;
        const imageUrl = await downloadAndUploadImage(wc.image.src, storagePath);
        if (imageUrl) {
          content.imageUrl = imageUrl;
        }
      }

      // 确定父分类 ID
      let parentId: string | null = null;
      if (wc.parent && wc.parent !== 0) {
        parentId = categoryMap.get(wc.parent) || null;
        if (!parentId) {
          console.warn(
            `    ⚠️ 父分类 WC ID ${wc.parent} 未找到，将作为根分类创建`
          );
        }
      }

      if (DRY_RUN) {
        console.log(`    [DRY RUN] 将创建/更新分类: ${wc.name}`);
        // 用负数模拟 ID 以维持映射
        categoryMap.set(wc.id, `dry-run-${wc.id}`);
        stats.categoriesCreated++;
        continue;
      }

      // Upsert: 通过 slug 判断是否已存在
      const existing = await prisma.category.findUnique({
        where: { slug: wc.slug },
      });

      let category;
      if (existing) {
        category = await prisma.category.update({
          where: { slug: wc.slug },
          data: {
            content: content as Prisma.InputJsonValue,
            parentId,
          },
        });
        console.log(`    ✅ 已更新分类: ${wc.name}`);
        stats.categoriesUpdated++;
      } else {
        category = await prisma.category.create({
          data: {
            slug: wc.slug,
            content: content as Prisma.InputJsonValue,
            parentId,
          },
        });
        console.log(`    ✅ 已创建分类: ${wc.name}`);
        stats.categoriesCreated++;
      }

      categoryMap.set(wc.id, category.id);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`    ❌ 分类导入失败 [${wc.name}]: ${errMsg}`);
      stats.errors.push({ item: `分类: ${wc.name}`, error: errMsg });
    }
  }

  console.log(`\n  分类导入完成: 创建 ${stats.categoriesCreated}, 更新 ${stats.categoriesUpdated}\n`);
  return categoryMap;
}

// ==================== 导入属性定义 ====================

/**
 * 确保 AttributeDefinition 和 AttributeOption 存在
 * 返回本地 AttributeDefinition ID
 */
async function ensureAttribute(
  wcName: string,
  options: string[]
): Promise<{ definitionId: string; optionIds: Map<string, string> }> {
  const info = resolveAttributeInfo(wcName);
  const optionIds = new Map<string, string>();

  if (DRY_RUN) {
    return { definitionId: `dry-run-attr-${info.key}`, optionIds };
  }

  // Upsert AttributeDefinition
  let attrDef = await prisma.attributeDefinition.findUnique({
    where: { key: info.key },
    include: { options: true },
  });

  if (!attrDef) {
    attrDef = await prisma.attributeDefinition.create({
      data: {
        key: info.key,
        name: { en: info.nameEn, es: info.nameEs } as Prisma.InputJsonValue,
        type: info.type,
        unit: info.unit || null,
        scope: info.scope,
        isFilterable: true,
        isHighlight: info.scope === "VARIANT",
      },
      include: { options: true },
    });
    stats.attributesCreated++;
    console.log(`    🏷️  创建属性定义: ${info.key} (${info.nameEs})`);
  }

  // 确保所有选项值存在
  for (const optionValue of options) {
    const trimmed = optionValue.trim();
    if (!trimmed) continue;

    const existingOption = attrDef.options.find((o) => o.value === trimmed);
    if (existingOption) {
      optionIds.set(trimmed, existingOption.id);
    } else {
      const newOption = await prisma.attributeOption.create({
        data: {
          value: trimmed,
          attributeId: attrDef.id,
        },
      });
      optionIds.set(trimmed, newOption.id);
      stats.attributeOptionsCreated++;
      // 更新 attrDef 缓存中的选项列表
      attrDef.options.push(newOption);
    }
  }

  return { definitionId: attrDef.id, optionIds };
}

// ==================== 导入产品 ====================

/**
 * 从 WooCommerce 导入所有产品及其变体
 */
async function importProducts(
  categoryMap: Map<number, string>
): Promise<void> {
  console.log("\n========================================");
  console.log("📦 第二步：导入产品");
  console.log("========================================\n");

  // 获取所有产品（分页）
  console.log("  正在从 WooCommerce 获取所有产品...");
  let wcProducts = await fetchAllPages<WCProduct>("products");
  console.log(`  共获取 ${wcProducts.length} 个产品\n`);

  // 如果设置了 limit，截断
  if (LIMIT > 0) {
    wcProducts = wcProducts.slice(0, LIMIT);
    console.log(`  [限制模式] 仅处理前 ${LIMIT} 个产品\n`);
  }

  for (let i = 0; i < wcProducts.length; i++) {
    const wc = wcProducts[i];
    const progress = `[${i + 1}/${wcProducts.length}]`;

    try {
      console.log(`\n${progress} 处理产品: ${wc.name} (WC ID: ${wc.id}, type: ${wc.type})`);

      // 跳过非标准产品类型
      if (wc.type === "grouped" || wc.type === "external") {
        console.log(`  ⏭️  跳过 ${wc.type} 类型产品`);
        stats.productsSkipped++;
        continue;
      }

      // --- 构建 SKU ---
      const baseSku = wc.sku?.trim() || `WC-${wc.slug}`;

      // --- 构建 content JSON ---
      const content: Record<string, any> = {
        es: {
          name: stripHtml(wc.name),
        },
      };

      if (wc.description) {
        content.es.description = wc.description; // 保留 HTML 格式
      }
      if (wc.short_description) {
        content.es.shortDescription = wc.short_description; // 保留 HTML 格式
      }

      // --- 处理产品图片 ---
      const imageUrls: string[] = [];
      if (wc.images && wc.images.length > 0) {
        for (let imgIdx = 0; imgIdx < wc.images.length; imgIdx++) {
          const img = wc.images[imgIdx];
          const ext = getExtFromUrl(img.src);
          const filename = `${imgIdx === 0 ? "main" : `gallery-${imgIdx}`}-${shortHash(img.src)}${ext}`;
          const storagePath = `${IMAGE_UPLOAD_PATH}/${wc.slug}/${filename}`;

          const uploadedUrl = await downloadAndUploadImage(img.src, storagePath);
          if (uploadedUrl) {
            imageUrls.push(uploadedUrl);
          } else if (!SKIP_IMAGES && !DRY_RUN) {
            // 上传失败但非跳过模式，保留原始 URL 作为备用
            imageUrls.push(img.src);
          }
          await delay(200); // 图片下载间隔
        }
      }
      if (imageUrls.length > 0) {
        content.images = imageUrls;
      }

      // --- 解析价格 ---
      // WooCommerce 逻辑：
      // - 如果有 sale_price：sale_price 是当前售价，regular_price 是原价（划线价）
      // - 如果没有 sale_price：regular_price 是当前售价
      let basePrice: number;
      let compareAtPrice: number | null = null;

      if (wc.sale_price && parseFloat(wc.sale_price) > 0) {
        basePrice = parseFloat(wc.sale_price);
        compareAtPrice = parseFloat(wc.regular_price);
      } else if (wc.regular_price && parseFloat(wc.regular_price) > 0) {
        basePrice = parseFloat(wc.regular_price);
      } else if (wc.price && parseFloat(wc.price) > 0) {
        basePrice = parseFloat(wc.price);
      } else {
        basePrice = 0;
      }

      // --- 确定分类 ---
      let categoryId: string | null = null;
      if (wc.categories && wc.categories.length > 0) {
        // 使用最后一个（最具体的）分类
        for (const cat of wc.categories) {
          const mapped = categoryMap.get(cat.id);
          if (mapped) {
            categoryId = mapped;
            break;
          }
        }
      }

      // --- 确定状态 ---
      const isActive = wc.status === "publish" && wc.stock_status !== "outofstock";

      // --- 解析 weight ---
      const weight = wc.weight ? parseFloat(wc.weight) : null;

      // --- 处理产品级属性（非变体属性） ---
      const productSpecs: Record<string, string> = {};
      if (wc.dimensions) {
        const dims = [];
        if (wc.dimensions.length) dims.push(`${wc.dimensions.length}cm`);
        if (wc.dimensions.width) dims.push(`${wc.dimensions.width}cm`);
        if (wc.dimensions.height) dims.push(`${wc.dimensions.height}cm`);
        if (dims.length > 0) {
          productSpecs.dimensions = dims.join(" × ");
        }
      }
      if (weight) {
        productSpecs.weight = `${weight}kg`;
      }

      // 处理非变体属性
      for (const attr of wc.attributes) {
        if (!attr.variation) {
          const attrKey = resolveAttributeKey(attr.name);
          productSpecs[attrKey] = attr.options.join(", ");

          // 同时确保 AttributeDefinition 和 AttributeOption 存在
          await ensureAttribute(attr.name, attr.options);
        }
      }

      // 将产品级规格存入 content
      if (Object.keys(productSpecs).length > 0) {
        content.specs = productSpecs;
      }

      if (DRY_RUN) {
        console.log(`  [DRY RUN] 将创建/更新产品: ${wc.name} (SKU: ${baseSku})`);
        if (wc.type === "variable") {
          console.log(`  [DRY RUN] 将获取变体...`);
        }
        stats.productsCreated++;
        continue;
      }

      // --- Upsert 产品 ---
      const existing = await prisma.product.findUnique({
        where: { slug: wc.slug },
        include: { variants: true },
      });

      let product;
      if (existing) {
        product = await prisma.product.update({
          where: { slug: wc.slug },
          data: {
            sku: baseSku,
            content: content as Prisma.InputJsonValue,
            isActive,
            categoryId,
          },
          include: { variants: true },
        });
        console.log(`  ✅ 已更新产品: ${wc.name}`);
        stats.productsUpdated++;
      } else {
        product = await prisma.product.create({
          data: {
            slug: wc.slug,
            sku: baseSku,
            content: content as Prisma.InputJsonValue,
            isActive,
            categoryId,
            type: "SIMPLE",
          },
          include: { variants: true },
        });
        console.log(`  ✅ 已创建产品: ${wc.name}`);
        stats.productsCreated++;
      }

      // --- 处理变体 ---
      if (wc.type === "variable" && wc.variations.length > 0) {
        await importVariations(wc, product.id, product.slug);
      } else if (wc.type === "simple") {
        // 简单产品：创建一个默认变体
        await upsertDefaultVariant(wc, product.id, baseSku, basePrice, compareAtPrice);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ 产品导入失败 [${wc.name}]: ${errMsg}`);
      stats.errors.push({ item: `产品: ${wc.name} (WC ID: ${wc.id})`, error: errMsg });
    }

    // API 调用间延迟
    if (i < wcProducts.length - 1) {
      await delay(API_DELAY_MS);
    }
  }

  console.log(`\n  产品导入完成: 创建 ${stats.productsCreated}, 更新 ${stats.productsUpdated}, 跳过 ${stats.productsSkipped}`);
  console.log(`  变体导入完成: 创建 ${stats.variantsCreated}, 更新 ${stats.variantsUpdated}`);
}

// ==================== 导入产品变体 ====================

/**
 * 获取并导入某个 variable 产品的所有变体
 */
async function importVariations(
  wcProduct: WCProduct,
  productId: string,
  productSlug: string
): Promise<void> {
  console.log(`  📋 获取变体 (WC 产品 ID: ${wcProduct.id})...`);

  try {
    const variations = await fetchAllPages<WCVariation>(
      `products/${wcProduct.id}/variations`
    );
    console.log(`    共 ${variations.length} 个变体`);

    // 处理变体属性的 AttributeDefinition
    for (const attr of wcProduct.attributes) {
      if (attr.variation) {
        await ensureAttribute(attr.name, attr.options);
      }
    }

    for (const variation of variations) {
      try {
        // 构建变体 SKU
        const variantSku = variation.sku?.trim() || `${productSlug}-var-${variation.id}`;

        // 解析变体价格
        let price: number;
        let compareAtPrice: number | null = null;

        if (variation.sale_price && parseFloat(variation.sale_price) > 0) {
          price = parseFloat(variation.sale_price);
          compareAtPrice = parseFloat(variation.regular_price);
        } else if (
          variation.regular_price &&
          parseFloat(variation.regular_price) > 0
        ) {
          price = parseFloat(variation.regular_price);
        } else if (variation.price && parseFloat(variation.price) > 0) {
          price = parseFloat(variation.price);
        } else {
          price = 0;
        }

        // 构建变体 specs（从变体属性中提取）
        const specs: Record<string, string> = {};
        for (const attr of variation.attributes) {
          if (attr.option) {
            const attrKey = resolveAttributeKey(attr.name);
            specs[attrKey] = attr.option;
          }
        }

        // 变体库存
        const stock = variation.manage_stock
          ? variation.stock_quantity || 0
          : 0;

        // 变体图片
        let variantContent: Record<string, any> | null = null;
        if (variation.image?.src) {
          const ext = getExtFromUrl(variation.image.src);
          const filename = `variant-${shortHash(variation.image.src)}${ext}`;
          const storagePath = `${IMAGE_UPLOAD_PATH}/${productSlug}/${filename}`;
          const imageUrl = await downloadAndUploadImage(
            variation.image.src,
            storagePath
          );
          if (imageUrl) {
            variantContent = { images: [imageUrl] };
          }
        }

        // Upsert 变体
        const existingVariant = await prisma.productVariant.findUnique({
          where: { sku: variantSku },
        });

        if (existingVariant) {
          await prisma.productVariant.update({
            where: { sku: variantSku },
            data: {
              price: new Prisma.Decimal(price),
              compareAtPrice: compareAtPrice
                ? new Prisma.Decimal(compareAtPrice)
                : null,
              specs: specs as Prisma.InputJsonValue,
              physicalStock: stock,
              content: variantContent
                ? (variantContent as Prisma.InputJsonValue)
                : undefined,
            },
          });
          console.log(`    ✅ 已更新变体: ${variantSku}`);
          stats.variantsUpdated++;
        } else {
          await prisma.productVariant.create({
            data: {
              productId,
              sku: variantSku,
              price: new Prisma.Decimal(price),
              compareAtPrice: compareAtPrice
                ? new Prisma.Decimal(compareAtPrice)
                : null,
              specs: specs as Prisma.InputJsonValue,
              physicalStock: stock,
              content: variantContent
                ? (variantContent as Prisma.InputJsonValue)
                : undefined,
            },
          });
          console.log(`    ✅ 已创建变体: ${variantSku}`);
          stats.variantsCreated++;
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `    ❌ 变体导入失败 [ID: ${variation.id}]: ${errMsg}`
        );
        stats.errors.push({
          item: `变体: ${productSlug} / VAR-${variation.id}`,
          error: errMsg,
        });
      }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `    ❌ 获取变体失败 [产品 WC ID: ${wcProduct.id}]: ${errMsg}`
    );
    stats.errors.push({
      item: `变体列表: ${wcProduct.name}`,
      error: errMsg,
    });
  }
}

/**
 * 为简单产品创建/更新默认变体
 * 每个 Product 至少需要一个 ProductVariant
 */
async function upsertDefaultVariant(
  wc: WCProduct,
  productId: string,
  sku: string,
  price: number,
  compareAtPrice: number | null
): Promise<void> {
  const stock = wc.manage_stock ? wc.stock_quantity || 0 : 0;

  // 构建 specs（从非变体属性中提取）
  const specs: Record<string, string> = {};
  for (const attr of wc.attributes) {
    const attrKey = resolveAttributeKey(attr.name);
    specs[attrKey] = attr.options.join(", ");
  }

  const existingVariant = await prisma.productVariant.findUnique({
    where: { sku },
  });

  if (existingVariant) {
    await prisma.productVariant.update({
      where: { sku },
      data: {
        price: new Prisma.Decimal(price),
        compareAtPrice: compareAtPrice
          ? new Prisma.Decimal(compareAtPrice)
          : null,
        specs: specs as Prisma.InputJsonValue,
        physicalStock: stock,
      },
    });
    console.log(`  ✅ 已更新默认变体: ${sku}`);
    stats.variantsUpdated++;
  } else {
    await prisma.productVariant.create({
      data: {
        productId,
        sku,
        price: new Prisma.Decimal(price),
        compareAtPrice: compareAtPrice
          ? new Prisma.Decimal(compareAtPrice)
          : null,
        specs: specs as Prisma.InputJsonValue,
        physicalStock: stock,
      },
    });
    console.log(`  ✅ 已创建默认变体: ${sku}`);
    stats.variantsCreated++;
  }
}

// ==================== 主流程 ====================

async function main(): Promise<void> {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║     WooCommerce → My LED ERP 数据迁移脚本             ║");
  console.log("╚════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`  源站点:      ${WC_URL}`);
  console.log(`  模式:        ${DRY_RUN ? "🔍 预览模式 (不写入数据库)" : "🚀 正式导入模式"}`);
  console.log(`  图片处理:    ${SKIP_IMAGES ? "⏭️  跳过" : "📥 下载并上传到 Supabase"}`);
  console.log(`  产品限制:    ${LIMIT > 0 ? `前 ${LIMIT} 个` : "全部"}`);
  console.log(`  仅分类:      ${CATEGORY_ONLY ? "是" : "否"}`);
  console.log();

  // 验证环境变量
  if (!WC_URL || !WC_KEY || !WC_SECRET) {
    throw new Error(
      "缺少 WooCommerce 环境变量！请检查 .env 文件中的 WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET"
    );
  }

  if (!SKIP_IMAGES && !DRY_RUN) {
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "缺少 Supabase 环境变量！请检查 .env 文件中的 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    // 确保 Supabase Storage bucket 存在
    console.log("  检查 Supabase Storage bucket...");
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === SUPABASE_BUCKET);
    if (!bucketExists) {
      console.log(`  创建 bucket: ${SUPABASE_BUCKET}`);
      const { error } = await supabase.storage.createBucket(SUPABASE_BUCKET, {
        public: true,
      });
      if (error) {
        console.warn(`  ⚠️ 创建 bucket 失败: ${error.message}（可能已存在）`);
      }
    } else {
      console.log(`  ✅ Bucket "${SUPABASE_BUCKET}" 已存在`);
    }
  }

  // 测试 WooCommerce API 连接
  console.log("\n  测试 WooCommerce API 连接...");
  try {
    const testResult = await fetchWC("products", { per_page: "1" });
    console.log(`  ✅ WooCommerce API 连接成功 (获取到 ${testResult.length} 个测试产品)\n`);
  } catch (err) {
    throw new Error(
      `WooCommerce API 连接失败: ${err instanceof Error ? err.message : err}`
    );
  }

  const startTime = Date.now();

  // 第一步：导入分类
  const categoryMap = await importCategories();

  // 第二步：导入产品
  if (!CATEGORY_ONLY) {
    await importProducts(categoryMap);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ==================== 汇总报告 ====================

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║                    导入完成报告                        ║");
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log(`║  总耗时:          ${elapsed} 秒`);
  console.log(`║  模式:            ${DRY_RUN ? "预览模式" : "正式导入"}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  📁 分类");
  console.log(`║    创建:          ${stats.categoriesCreated}`);
  console.log(`║    更新:          ${stats.categoriesUpdated}`);
  console.log(`║    跳过:          ${stats.categoriesSkipped}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  📦 产品");
  console.log(`║    创建:          ${stats.productsCreated}`);
  console.log(`║    更新:          ${stats.productsUpdated}`);
  console.log(`║    跳过:          ${stats.productsSkipped}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  🔀 变体");
  console.log(`║    创建:          ${stats.variantsCreated}`);
  console.log(`║    更新:          ${stats.variantsUpdated}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  🏷️  属性");
  console.log(`║    定义创建:      ${stats.attributesCreated}`);
  console.log(`║    选项创建:      ${stats.attributeOptionsCreated}`);
  console.log("╠════════════════════════════════════════════════════════╣");
  console.log("║  🖼️  图片");
  console.log(`║    上传成功:      ${stats.imagesUploaded}`);
  console.log(`║    跳过:          ${stats.imagesSkipped}`);
  console.log(`║    失败:          ${stats.imagesFailed}`);
  console.log("╠════════════════════════════════════════════════════════╣");

  if (stats.errors.length > 0) {
    console.log(`║  ❌ 错误 (${stats.errors.length} 个):`);
    for (const err of stats.errors) {
      console.log(`║    - ${err.item}`);
      console.log(`║      ${err.error.slice(0, 80)}`);
    }
  } else {
    console.log("║  ✅ 无错误");
  }

  console.log("╚════════════════════════════════════════════════════════╝\n");
}

// ==================== 执行 ====================

main()
  .catch((err) => {
    console.error("\n💥 迁移脚本致命错误:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
