/**
 * 批量翻译脚本：将所有产品的 es 内容翻译到其他 8 种语言
 *
 * 用法：
 *   npx tsx scripts/batch-translate.ts [--dry-run] [--force] [--source=es] [--field=name,description,seoTitle,seoDescription]
 *
 * 参数：
 *   --dry-run     预览模式，不实际修改数据
 *   --force       强制覆盖已有翻译（默认跳过已翻译的字段）
 *   --source=xx   源语言，默认 es
 *   --field=x,y   只翻译指定字段（逗号分隔），默认全部 4 个
 *   --slug=xxx    只翻译指定 slug 的产品
 *
 * 前置条件：
 *   - .env 中有 OPENROUTER_API_KEY 和 OPENROUTER_MODEL
 *   - .env 中有 DIRECT_URL 或 DATABASE_URL
 */

import * as dotenv from "dotenv";
dotenv.config();

import { PrismaClient } from "@prisma/client";

// ── CLI 参数解析 ────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

const SOURCE_LANG =
  args.find((a) => a.startsWith("--source="))?.split("=")[1] || "es";

const FIELD_ARG = args.find((a) => a.startsWith("--field="))?.split("=")[1];
const FIELDS = FIELD_ARG
  ? FIELD_ARG.split(",")
  : ["name", "description", "seoTitle", "seoDescription"];

const SLUG_ARG = args.find((a) => a.startsWith("--slug="))?.split("=")[1];

// ── 常量 ────────────────────────────────────────────────────
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const SYSTEM_PROMPT =
  "你是一个专业的 LED 行业翻译官。请将源文本翻译成目标语言，注意专业术语：如 CCT(色温), Beam Angle(发光角度), Driver(驱动/电源)。如果是中文源，请翻译成地道的当地行业用语。";

const SUPPORTED_LOCALES = ["zh", "es", "en", "de", "fr", "it", "pt", "nl", "pl"];
const LOCALE_NAMES: Record<string, string> = {
  zh: "Chinese",
  es: "Spanish",
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
};

const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const DELAY_BETWEEN_CALLS_MS = 1500; // 避免被限流

// ── 初始化 ──────────────────────────────────────────────────
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } },
});

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL;

// ── 统计 ────────────────────────────────────────────────────
const stats = {
  totalProducts: 0,
  translatedProducts: 0,
  skippedProducts: 0,
  apiCalls: 0,
  fieldsTranslated: 0,
  fieldsSkipped: 0,
  errors: [] as string[],
};

// ── 类型定义 ────────────────────────────────────────────────
interface LocaleContent {
  name?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
}

interface ProductContent {
  [locale: string]: LocaleContent | string[] | unknown;
  images?: string[];
}

// ── 工具函数 ────────────────────────────────────────────────
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanJsonText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ── 翻译函数 ────────────────────────────────────────────────
async function translateText(
  sourceLang: string,
  sourceText: string
): Promise<Record<string, string>> {
  const targetLocales = SUPPORTED_LOCALES.filter((l) => l !== sourceLang);
  const userPrompt = [
    `Source language: ${LOCALE_NAMES[sourceLang] || sourceLang}`,
    `Target languages: ${targetLocales.map((l) => LOCALE_NAMES[l] || l).join(", ")}`,
    "Rules:",
    "1) Preserve placeholders like {count}, {name}, {{variable}}.",
    "2) Preserve HTML tags and line breaks.",
    "3) 你必须严格返回一个合法的 JSON 对象，不要包含任何 Markdown 代码块标签（如 ```json），不要有任何前言或后缀。确保输入的每一个 Key 都在返回的 JSON 中出现。",
    `4) JSON keys must be exactly: ${targetLocales.join(", ")}.`,
    "",
    `Text: ${sourceText}`,
  ].join("\n");

  let attempt = 0;
  while (true) {
    const response = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "LED ERP batch translate",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
        }),
      },
      TIMEOUT_MS
    );

    if (response.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      console.log(`    ⏳ 速率限制，等待 ${RETRY_DELAYS_MS[attempt] / 1000}s 后重试...`);
      await sleep(RETRY_DELAYS_MS[attempt]);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenRouter API returned empty content");

    stats.apiCalls++;
    return JSON.parse(cleanJsonText(content)) as Record<string, string>;
  }
}

// ── 主流程 ──────────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║      批量翻译脚本 - Leader Madrid              ║");
  console.log("╚══════════════════════════════════════════════╝");

  if (!apiKey || !model) {
    console.error("\n✗ 缺少 OPENROUTER_API_KEY 或 OPENROUTER_MODEL 环境变量");
    process.exit(1);
  }

  if (DRY_RUN) console.log("\n⚠ 预览模式 (--dry-run)：不会实际修改数据\n");
  console.log(`  源语言: ${SOURCE_LANG}`);
  console.log(`  翻译字段: ${FIELDS.join(", ")}`);
  console.log(`  强制覆盖: ${FORCE ? "是" : "否"}`);
  console.log(`  模型: ${model}`);
  if (SLUG_ARG) console.log(`  指定产品: ${SLUG_ARG}`);
  console.log();

  // 获取所有产品
  const where = SLUG_ARG ? { slug: SLUG_ARG } : {};
  const products = await prisma.product.findMany({
    where,
    select: { id: true, slug: true, content: true },
    orderBy: { slug: "asc" },
  });

  stats.totalProducts = products.length;
  console.log(`  找到 ${products.length} 个产品\n`);

  const targetLocales = SUPPORTED_LOCALES.filter((l) => l !== SOURCE_LANG);

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const content = product.content as ProductContent;
    const sourceContent = content[SOURCE_LANG] as LocaleContent | undefined;

    if (!sourceContent) {
      console.log(`  [${i + 1}/${products.length}] ${product.slug} — 跳过（无 ${SOURCE_LANG} 内容）`);
      stats.skippedProducts++;
      continue;
    }

    console.log(`  [${i + 1}/${products.length}] ${product.slug}`);

    let productHasChanges = false;
    const updatedContent = { ...content };

    for (const field of FIELDS) {
      const sourceText = sourceContent[field as keyof LocaleContent];
      if (!sourceText || !sourceText.trim()) {
        stats.fieldsSkipped++;
        continue;
      }

      // 检查是否需要翻译（如果非 force 模式，检查目标语言是否已有内容）
      if (!FORCE) {
        const allHaveContent = targetLocales.every((locale) => {
          const localeContent = content[locale] as LocaleContent | undefined;
          const val = localeContent?.[field as keyof LocaleContent];
          return val && val.trim().length > 0;
        });

        if (allHaveContent) {
          console.log(`    ✓ ${field} — 所有语言已有翻译，跳过`);
          stats.fieldsSkipped++;
          continue;
        }
      }

      console.log(`    → 翻译 ${field} (${sourceText.length} 字符)...`);

      if (DRY_RUN) {
        console.log(`      [预览] 将翻译到: ${targetLocales.join(", ")}`);
        stats.fieldsTranslated++;
        continue;
      }

      try {
        const translations = await translateText(SOURCE_LANG, sourceText);

        // 将翻译结果写入 content
        for (const locale of targetLocales) {
          const translated = translations[locale];
          if (!translated) continue;

          const existingLocale = (updatedContent[locale] as LocaleContent) || {};
          const existingValue = existingLocale[field as keyof LocaleContent];

          // 如果非 force 且已有内容，跳过该语言
          if (!FORCE && existingValue && existingValue.trim().length > 0) {
            continue;
          }

          updatedContent[locale] = {
            ...existingLocale,
            [field]: translated,
          };
          productHasChanges = true;
        }

        stats.fieldsTranslated++;
        console.log(`      ✓ 完成`);

        // 请求间隔，避免限流
        await sleep(DELAY_BETWEEN_CALLS_MS);
      } catch (err) {
        const msg = `${product.slug}.${field}: ${(err as Error).message}`;
        console.log(`      ✗ 翻译失败: ${(err as Error).message}`);
        stats.errors.push(msg);
      }
    }

    // 写入数据库
    if (productHasChanges && !DRY_RUN) {
      await prisma.product.update({
        where: { id: product.id },
        data: { content: updatedContent as any },
      });
      stats.translatedProducts++;
      console.log(`    ✓ 已保存`);
    } else if (DRY_RUN && FIELDS.some((f) => {
      const v = sourceContent[f as keyof LocaleContent];
      return v && v.trim().length > 0;
    })) {
      stats.translatedProducts++;
    } else if (!productHasChanges) {
      stats.skippedProducts++;
    }
  }

  await prisma.$disconnect();

  // ── 汇总报告 ────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║                 执行报告                       ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  产品总数:    ${stats.totalProducts}`.padEnd(46) + "║");
  console.log(`║  已翻译:      ${stats.translatedProducts}`.padEnd(46) + "║");
  console.log(`║  已跳过:      ${stats.skippedProducts}`.padEnd(46) + "║");
  console.log(`║  API 调用数:  ${stats.apiCalls}`.padEnd(46) + "║");
  console.log(`║  字段翻译数:  ${stats.fieldsTranslated}`.padEnd(46) + "║");
  console.log(`║  字段跳过数:  ${stats.fieldsSkipped}`.padEnd(46) + "║");
  if (stats.errors.length > 0) {
    console.log("╠══════════════════════════════════════════════╣");
    console.log("║  错误列表:".padEnd(46) + "║");
    for (const e of stats.errors) {
      console.log(`║  - ${e.slice(0, 40)}`.padEnd(46) + "║");
    }
  }
  console.log("╚══════════════════════════════════════════════╝");
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
