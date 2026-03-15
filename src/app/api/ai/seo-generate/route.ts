import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 30_000;

const LOCALE_NAMES: Record<string, string> = {
  zh: "Chinese (Simplified)",
  es: "Spanish",
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  pl: "Polish",
};

type SeoGenerateRequest = {
  name: string;
  description?: string;
  sku?: string;
  brand?: string;
  locale: string;
};

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

export async function POST(request: Request) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as SeoGenerateRequest;
    const { name, description, sku, brand, locale } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL;
    if (!apiKey || !model) {
      return NextResponse.json(
        { error: "Missing OPENROUTER_API_KEY or OPENROUTER_MODEL" },
        { status: 500 }
      );
    }

    const langName = LOCALE_NAMES[locale] || "English";

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
    ]
      .filter(Boolean)
      .join("\n");

    const response = await fetchWithTimeout(
      OPENROUTER_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "LED ERP seo-generate",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
        }),
      },
      TIMEOUT_MS
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter API returned empty content");
    }

    const parsed = JSON.parse(cleanJsonText(content)) as {
      seoTitle: string;
      seoDescription: string;
    };

    if (!parsed.seoTitle || !parsed.seoDescription) {
      throw new Error("AI returned incomplete SEO data");
    }

    return NextResponse.json({
      seoTitle: String(parsed.seoTitle).slice(0, 70),
      seoDescription: String(parsed.seoDescription).slice(0, 200),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
