import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45_000;

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

type GenerateDescriptionRequest = {
  locale: string;
  productName: string;
  sku?: string;
  brand?: string;
  categoryName?: string;
  specs?: Record<string, { label: string; value: string; unit?: string }[]>;
  documents?: { type: string; name: string }[];
};

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
    const body = (await request.json()) as GenerateDescriptionRequest;
    const { locale, productName, sku, brand, categoryName, specs, documents } = body;

    if (!productName?.trim()) {
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

    const systemPrompt = `You are a premium B2B LED lighting product copywriter. Write product descriptions in ${langName}. Output ONLY raw HTML — no markdown, no code fences, no preamble, no explanation. Use only real data provided; never invent specifications or certifications.`;

    const specLines: string[] = [];
    if (specs) {
      for (const [, entries] of Object.entries(specs)) {
        if (Array.isArray(entries)) {
          for (const entry of entries) {
            const unitStr = entry.unit ? ` ${entry.unit}` : "";
            specLines.push(`- ${entry.label}: ${entry.value}${unitStr}`);
          }
        }
      }
    }

    const docLines: string[] = [];
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        docLines.push(`- ${doc.type}: ${doc.name}`);
      }
    }

    // Build a complete HTML example so the AI copies the exact structure.
    // Tech specs and certifications are rendered separately by the component.
    // AI generates: intro + application scenarios (cards) + key features (cards).
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
      "5. Application Scenarios: EXACTLY 4 <li> items WITHOUT data-icon. Focus on WHERE/HOW the product is used (e.g. hotels, offices, retail, residential).",
      "6. Key Features: EXACTLY 6 <li> items, each MUST have a data-icon attribute. Focus on WHAT makes the product good technically.",
      "   Available icons: sun, zap, shield, award, clock, thermometer, eye, check.",
      "7. CRITICAL: every <li> text (including <strong>) must be 100-120 characters for equal card heights.",
      "8. Every <ul> MUST have class=\"features\". Only Key Features <li> items need data-icon attributes.",
      "9. Do NOT use <h1> or <h2>. Do NOT invent data not provided above.",
      `10. ALL text including h3 headings must be in ${langName}.`,
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
          "X-Title": "LED ERP generate-description",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
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

    // Strip markdown code fences if the model wraps output
    const cleaned = content
      .trim()
      .replace(/^```html\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    return NextResponse.json({ description: cleaned });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
