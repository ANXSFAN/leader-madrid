/**
 * 批量生成 + 翻译脚本：
 *   1. 为每个产品 AI 生成西班牙语描述（HTML 格式）
 *   2. 为每个产品 AI 生成西班牙语 SEO (seoTitle + seoDescription)
 *   3. 将 name, description, seoTitle, seoDescription 翻译到其他 8 种语言
 *
 * 用法：
 *   npx tsx scripts/batch-generate-and-translate.ts [选项]
 *
 * 选项：
 *   --dry-run           预览模式，不修改数据
 *   --skip-generate     跳过生成，只翻译（如果描述已经生成好了）
 *   --skip-translate    跳过翻译，只生成描述和 SEO
 *   --force             强制覆盖已有内容
 *   --slug=xxx          只处理指定产品
 *   --start=N           从第 N 个产品开始（用于断点续跑）
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

// ── CLI ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const SKIP_GENERATE = args.includes("--skip-generate");
const SKIP_TRANSLATE = args.includes("--skip-translate");
const SLUG_ARG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];
const START_FROM = parseInt(args.find((a) => a.startsWith("--start="))?.split("=")[1] || "1", 10);

// ── 常量 ────────────────────────────────────────────────────
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const DELAY_BETWEEN_CALLS_MS = 1500;

const SOURCE_LANG = "es";
const SUPPORTED_LOCALES = ["zh", "es", "en", "de", "fr", "it", "pt", "nl", "pl"];
const LOCALE_NAMES: Record<string, string> = {
  zh: "Chinese", es: "Spanish", en: "English", de: "German",
  fr: "French", it: "Italian", pt: "Portuguese", nl: "Dutch", pl: "Polish",
};

// ── 初始化 ──────────────────────────────────────────────────
const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL || "";
// 增大连接池超时，避免长时间运行时 P2024 错误
const separator = dbUrl.includes("?") ? "&" : "?";
const dbUrlWithPool = `${dbUrl}${separator}connection_limit=5&pool_timeout=60`;

let prisma = new PrismaClient({
  datasources: { db: { url: dbUrlWithPool } },
});

// 定期重连，避免连接池耗尽
async function reconnectPrisma() {
  await prisma.$disconnect();
  prisma = new PrismaClient({
    datasources: { db: { url: dbUrlWithPool } },
  });
}
const apiKey = process.env.OPENROUTER_API_KEY!;
const model = process.env.OPENROUTER_MODEL!;

// ── 统计 ────────────────────────────────────────────────────
const stats = {
  total: 0,
  descGenerated: 0,
  descSkipped: 0,
  seoGenerated: 0,
  seoSkipped: 0,
  translated: 0,
  translateSkipped: 0,
  apiCalls: 0,
  errors: [] as string[],
};

// ── 类型 ────────────────────────────────────────────────────
interface LocaleContent {
  name?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}
interface ProductContent {
  [key: string]: LocaleContent | string[] | unknown;
}
interface CategoryContent {
  es?: { name?: string };
  en?: { name?: string };
  [key: string]: unknown;
}

// ── 工具函数 ────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function cleanJson(s: string) {
  return s.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
}

function cleanHtml(s: string) {
  return s.trim().replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...init, signal: c.signal }); }
  finally { clearTimeout(t); }
}

async function callOpenRouter(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.3
): Promise<string> {
  let attempt = 0;
  while (true) {
    const res = await fetchWithTimeout(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "LED ERP batch generate",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature,
      }),
    }, TIMEOUT_MS);

    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      console.log(`      ⏳ 限流，等待 ${RETRY_DELAYS_MS[attempt] / 1000}s...`);
      await sleep(RETRY_DELAYS_MS[attempt]);
      attempt++;
      continue;
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`API ${res.status}: ${txt.slice(0, 200)}`);
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("API returned empty content");
    stats.apiCalls++;
    return content;
  }
}

// ── 生成描述 ────────────────────────────────────────────────
async function generateDescription(
  productName: string,
  sku: string,
  brand: string | null,
  categoryName: string | null,
  specs: Record<string, unknown> | null,
  documents: Array<{ type: string; name: string }> | null
): Promise<string> {
  const langName = "Spanish";

  const specLines: string[] = [];
  if (specs) {
    for (const [key, value] of Object.entries(specs)) {
      if (value && typeof value === "string") {
        specLines.push(`- ${key}: ${value}`);
      }
    }
  }

  const docLines: string[] = [];
  if (documents) {
    for (const doc of documents) {
      docLines.push(`- ${doc.type}: ${doc.name}`);
    }
  }

  const htmlExample = `<p>1-2 sentence product intro: what it is and its core value proposition.</p>

<h3>Application Scenarios</h3>
<ul class="features">
<li><strong>Scenario Name:</strong> Brief description of how/where the product is used, 100-120 chars.</li>
<li><strong>Scenario Name:</strong> Brief description of how/where the product is used, 100-120 chars.</li>
<li><strong>Scenario Name:</strong> Brief description of how/where the product is used, 100-120 chars.</li>
<li><strong>Scenario Name:</strong> Brief description of how/where the product is used, 100-120 chars.</li>
</ul>

<h3>Key Features</h3>
<ul class="features">
<li data-icon="sun"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
<li data-icon="zap"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
<li data-icon="shield"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
<li data-icon="eye"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
<li data-icon="clock"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
<li data-icon="award"><strong>Feature Title:</strong> Brief technical description, keep each item 100-120 characters total.</li>
</ul>`;

  const systemPrompt = `You are a premium B2B LED lighting product copywriter. Write product descriptions in ${langName}. Output ONLY raw HTML — no markdown, no code fences, no preamble, no explanation. Use only real data provided; never invent specifications or certifications.`;

  const userPrompt = [
    `Generate a product description for this LED product. Write entirely in ${langName}.`,
    "",
    `Product Name: ${productName}`,
    sku ? `SKU: ${sku}` : null,
    brand ? `Brand: ${brand}` : null,
    categoryName ? `Category: ${categoryName}` : null,
    specLines.length > 0 ? `\nReference specs (use to write features, do NOT list them as a table):\n${specLines.join("\n")}` : null,
    docLines.length > 0 ? `\nReference certifications (do NOT output these, they are shown separately):\n${docLines.join("\n")}` : null,
    "",
    "=== MANDATORY HTML TEMPLATE (copy this structure EXACTLY) ===",
    htmlExample,
    "=== END TEMPLATE ===",
    "",
    "STRICT RULES:",
    "1. Output ONLY raw HTML. No markdown. No code fences. No explanation text.",
    "2. Output EXACTLY 3 sections in order: one <p>, then <h3>+<ul> for scenarios, then <h3>+<ul> for features.",
    "3. Do NOT output any technical specifications table — it is rendered separately by the UI.",
    "4. Do NOT output any certifications section — it is rendered separately by the UI.",
    "5. Application Scenarios: EXACTLY 4 <li> items WITHOUT data-icon. Focus on WHERE/HOW the product is used.",
    "6. Key Features: EXACTLY 6 <li> items, each MUST have a data-icon attribute.",
    "   Available icons: sun, zap, shield, award, clock, thermometer, eye, check.",
    "7. CRITICAL: every <li> text (including <strong>) must be 100-120 characters for equal card heights.",
    "8. Every <ul> MUST have class=\"features\". Only Key Features <li> items need data-icon attributes.",
    "9. Do NOT use <h1> or <h2>. Do NOT invent data not provided above.",
    `10. ALL text including h3 headings must be in ${langName}.`,
  ].filter(Boolean).join("\n");

  const raw = await callOpenRouter(systemPrompt, userPrompt, 0.4);
  return cleanHtml(raw);
}

// ── 生成 SEO ────────────────────────────────────────────────
async function generateSeo(
  name: string,
  description: string,
  sku: string,
  brand: string | null
): Promise<{ seoTitle: string; seoDescription: string }> {
  const langName = "Spanish";

  const systemPrompt = `You are an SEO expert specializing in professional LED lighting products for B2B and B2C markets. Generate optimized SEO metadata in ${langName}. Use natural industry terminology (CCT, Beam Angle, IP rating, lm/W, etc.).`;

  const userPrompt = [
    `Generate an SEO title and meta description for this LED product in ${langName}.`,
    "",
    `Product Name: ${name}`,
    brand ? `Brand: ${brand}` : null,
    sku ? `SKU: ${sku}` : null,
    description ? `Product Description: ${description.slice(0, 600)}` : null,
    "",
    "Rules:",
    "- seoTitle: 50–60 characters max. Include product name and 1–2 key features or brand. No keyword stuffing.",
    "- seoDescription: 130–160 characters. Compelling, action-oriented, mentions key benefit, ends with a subtle CTA.",
    `- Write entirely in ${langName}.`,
    "- Return ONLY a valid JSON object with exactly these two keys: seoTitle, seoDescription.",
    "- No markdown code blocks, no preamble, no explanation.",
  ].filter(Boolean).join("\n");

  const raw = await callOpenRouter(systemPrompt, userPrompt, 0.3);
  const parsed = JSON.parse(cleanJson(raw)) as { seoTitle: string; seoDescription: string };
  return {
    seoTitle: String(parsed.seoTitle).slice(0, 70),
    seoDescription: String(parsed.seoDescription).slice(0, 200),
  };
}

// ── 翻译（合并多字段为一次调用）────────────────────────────
// 输入: { description: "...", seoTitle: "...", seoDescription: "..." }
// 输出: { zh: { description: "...", seoTitle: "...", ... }, en: { ... }, ... }
async function translateFields(
  fields: Record<string, string>
): Promise<Record<string, Record<string, string>>> {
  const targetLocales = SUPPORTED_LOCALES.filter((l) => l !== SOURCE_LANG);
  const systemPrompt = "你是一个专业的 LED 行业翻译官。请将源文本翻译成目标语言，注意专业术语：如 CCT(色温), Beam Angle(发光角度), Driver(驱动/电源)。如果是中文源，请翻译成地道的当地行业用语。";

  const fieldKeys = Object.keys(fields);
  const sourceJson = JSON.stringify(fields);

  const userPrompt = [
    `Source language: ${LOCALE_NAMES[SOURCE_LANG]}`,
    `Target languages: ${targetLocales.map((l) => LOCALE_NAMES[l]).join(", ")}`,
    "Rules:",
    "1) Preserve placeholders like {count}, {name}, {{variable}}.",
    "2) Preserve HTML tags and line breaks.",
    "3) The source is a JSON object with multiple fields. Translate EACH field independently.",
    `4) Return a JSON object where top-level keys are locale codes (${targetLocales.join(", ")}), and each value is an object with the same field keys (${fieldKeys.join(", ")}).`,
    "5) 你必须严格返回一个合法的 JSON 对象，不要包含任何 Markdown 代码块标签，不要有任何前言或后缀。",
    "",
    `Source JSON: ${sourceJson}`,
  ].join("\n");

  const raw = await callOpenRouter(systemPrompt, userPrompt, 0.2);
  return JSON.parse(cleanJson(raw)) as Record<string, Record<string, string>>;
}

// ── 主流程 ──────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║   批量生成描述 + SEO + 翻译 - Leader Madrid        ║");
  console.log("╚══════════════════════════════════════════════════╝");

  if (!apiKey || !model) {
    console.error("\n✗ 缺少 OPENROUTER_API_KEY 或 OPENROUTER_MODEL");
    process.exit(1);
  }

  if (DRY_RUN) console.log("\n⚠ 预览模式\n");
  console.log(`  模型: ${model}`);
  console.log(`  生成描述: ${SKIP_GENERATE ? "跳过" : "是"}`);
  console.log(`  翻译: ${SKIP_TRANSLATE ? "跳过" : "是"}`);
  console.log(`  强制覆盖: ${FORCE ? "是" : "否"}`);
  if (SLUG_ARG) console.log(`  指定产品: ${SLUG_ARG}`);
  if (START_FROM > 1) console.log(`  从第 ${START_FROM} 个开始`);
  console.log();

  // 获取产品
  const where = SLUG_ARG ? { slug: SLUG_ARG } : {};
  const products = await prisma.product.findMany({
    where,
    select: {
      id: true,
      slug: true,
      brand: true,
      content: true,
      category: { select: { content: true } },
      variants: { take: 1, select: { sku: true, specs: true } },
      documents: { select: { type: true, name: true } },
    },
    orderBy: { slug: "asc" },
  });

  stats.total = products.length;
  console.log(`  找到 ${products.length} 个产品\n`);

  const targetLocales = SUPPORTED_LOCALES.filter((l) => l !== SOURCE_LANG);

  for (let i = 0; i < products.length; i++) {
    const seq = i + 1;
    if (seq < START_FROM) continue;

    // 每 50 个产品重连数据库，避免连接池耗尽
    if (seq > START_FROM && (seq - START_FROM) % 50 === 0) {
      console.log(`\n  🔄 重连数据库 (已处理 ${seq - START_FROM} 个)...\n`);
      await reconnectPrisma();
    }

    const product = products[i];
    const content = (product.content || {}) as ProductContent;
    const esContent = (content[SOURCE_LANG] || {}) as LocaleContent;
    const categoryContent = product.category?.content as CategoryContent | null;
    const categoryName = categoryContent?.es?.name || categoryContent?.en?.name || null;
    const sku = product.variants[0]?.sku || product.slug;
    const specs = product.variants[0]?.specs as Record<string, unknown> | null;
    const productName = esContent.name || product.slug;

    console.log(`  [${seq}/${products.length}] ${product.slug}`);

    let updatedContent = { ...content };
    let updatedEs = { ...esContent };
    let hasChanges = false;

    // ── STEP 1: 生成描述 ──────────────────────────────────
    if (!SKIP_GENERATE) {
      // 检查是否已有 AI 生成的描述（含 class="features" 标记）
      const hasAiDesc = esContent.description?.includes('class="features"');

      if (hasAiDesc && !FORCE) {
        console.log(`    ✓ 描述已有 AI 格式，跳过生成`);
        stats.descSkipped++;
      } else {
        console.log(`    → 生成描述...`);
        if (!DRY_RUN) {
          try {
            const desc = await generateDescription(
              productName, sku, product.brand, categoryName, specs, product.documents
            );
            updatedEs.description = desc;
            hasChanges = true;
            stats.descGenerated++;
            console.log(`      ✓ 描述已生成 (${desc.length} 字符)`);
            await sleep(DELAY_BETWEEN_CALLS_MS);
          } catch (err) {
            const msg = `${product.slug} 描述生成: ${(err as Error).message}`;
            console.log(`      ✗ ${(err as Error).message}`);
            stats.errors.push(msg);
          }
        } else {
          console.log(`      [预览] 将生成描述`);
          stats.descGenerated++;
        }
      }

      // ── STEP 2: 生成 SEO ──────────────────────────────────
      const hasSeo = esContent.seoTitle && esContent.seoDescription;

      if (hasSeo && !FORCE) {
        console.log(`    ✓ SEO 已存在，跳过生成`);
        stats.seoSkipped++;
      } else {
        console.log(`    → 生成 SEO...`);
        if (!DRY_RUN) {
          try {
            const currentDesc = updatedEs.description || esContent.description || "";
            const seo = await generateSeo(productName, currentDesc, sku, product.brand);
            updatedEs.seoTitle = seo.seoTitle;
            updatedEs.seoDescription = seo.seoDescription;
            hasChanges = true;
            stats.seoGenerated++;
            console.log(`      ✓ SEO: "${seo.seoTitle}"`);
            await sleep(DELAY_BETWEEN_CALLS_MS);
          } catch (err) {
            const msg = `${product.slug} SEO生成: ${(err as Error).message}`;
            console.log(`      ✗ ${(err as Error).message}`);
            stats.errors.push(msg);
          }
        } else {
          console.log(`      [预览] 将生成 SEO`);
          stats.seoGenerated++;
        }
      }
    }

    // 保存生成结果到 content
    if (hasChanges) {
      updatedContent[SOURCE_LANG] = updatedEs;
    }

    // ── STEP 3: 翻译（合并所有字段为 1 次 API 调用）────────
    if (!SKIP_TRANSLATE) {
      // 收集需要翻译的字段（跳过 name，上次已翻译；只翻译新生成的内容）
      const fieldsToTranslate: Record<string, string> = {};
      for (const field of ["description", "seoTitle", "seoDescription"] as const) {
        const sourceText = updatedEs[field];
        if (!sourceText || !sourceText.trim()) continue;

        if (!FORCE) {
          const allDone = targetLocales.every((l) => {
            const lc = updatedContent[l] as LocaleContent | undefined;
            return lc?.[field] && lc[field]!.trim().length > 0;
          });
          if (allDone) {
            stats.translateSkipped++;
            continue;
          }
        }
        fieldsToTranslate[field] = sourceText;
      }

      if (Object.keys(fieldsToTranslate).length > 0) {
        const fieldNames = Object.keys(fieldsToTranslate).join(", ");
        console.log(`    → 翻译 ${fieldNames} (合并1次调用)...`);
        if (!DRY_RUN) {
          try {
            const translations = await translateFields(fieldsToTranslate);
            for (const locale of targetLocales) {
              if (!translations[locale]) continue;
              const existing = (updatedContent[locale] || {}) as LocaleContent;
              const merged = { ...existing };
              for (const [field, value] of Object.entries(translations[locale])) {
                if (!value) continue;
                const existingVal = existing[field as keyof LocaleContent];
                if (!FORCE && existingVal && existingVal.trim()) continue;
                (merged as any)[field] = value;
              }
              updatedContent[locale] = merged;
            }
            hasChanges = true;
            stats.translated += Object.keys(fieldsToTranslate).length;
            console.log(`      ✓ 完成`);
            await sleep(DELAY_BETWEEN_CALLS_MS);
          } catch (err) {
            const msg = `${product.slug} 翻译: ${(err as Error).message}`;
            console.log(`      ✗ ${(err as Error).message}`);
            stats.errors.push(msg);
          }
        } else {
          console.log(`      [预览] 将翻译到 ${targetLocales.length} 种语言`);
          stats.translated += Object.keys(fieldsToTranslate).length;
        }
      }
    }

    // ── 保存 ────────────────────────────────────────────────
    if (hasChanges && !DRY_RUN) {
      await prisma.product.update({
        where: { id: product.id },
        data: { content: updatedContent as any },
      });
      console.log(`    ✓ 已保存`);
    }
  }

  await prisma.$disconnect();

  // ── 报告 ──────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║                    执行报告                        ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  产品总数:      ${stats.total}`.padEnd(50) + "║");
  console.log(`║  描述生成:      ${stats.descGenerated} (跳过 ${stats.descSkipped})`.padEnd(50) + "║");
  console.log(`║  SEO 生成:      ${stats.seoGenerated} (跳过 ${stats.seoSkipped})`.padEnd(50) + "║");
  console.log(`║  字段翻译:      ${stats.translated} (跳过 ${stats.translateSkipped})`.padEnd(50) + "║");
  console.log(`║  API 调用总数:  ${stats.apiCalls}`.padEnd(50) + "║");
  if (stats.errors.length > 0) {
    console.log("╠══════════════════════════════════════════════════╣");
    console.log(`║  错误: ${stats.errors.length} 个`.padEnd(50) + "║");
    for (const e of stats.errors.slice(0, 10)) {
      console.log(`║  - ${e.slice(0, 44)}`.padEnd(50) + "║");
    }
    if (stats.errors.length > 10) {
      console.log(`║  ... 还有 ${stats.errors.length - 10} 个错误`.padEnd(50) + "║");
    }
  }
  console.log("╚══════════════════════════════════════════════════╝");

  // 返回退出码，方便脚本链式调用
  if (stats.errors.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
