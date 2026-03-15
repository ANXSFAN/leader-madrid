import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const SYSTEM_PROMPT =
  "你是一个专业的 LED 行业翻译官。请将源文本翻译成目标语言，注意专业术语：如 CCT(色温), Beam Angle(发光角度), Driver(驱动/电源)。如果是中文源，请翻译成地道的当地行业用语。";
const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

const SUPPORTED_LOCALES = [
  "zh",
  "es",
  "en",
  "de",
  "fr",
  "it",
  "pt",
  "nl",
  "pl",
] as const;

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

type TranslateRequest = {
  sourceLang: string;
  sourceText: string;
};

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanJsonText(value: string) {
  return value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateAll(
  apiKey: string,
  model: string,
  sourceLang: string,
  sourceText: string
) {
  const targetLocales = SUPPORTED_LOCALES.filter(
    (locale) => locale !== sourceLang
  );
  const userPrompt = [
    `Source language: ${LOCALE_NAMES[sourceLang] || sourceLang}`,
    `Target languages: ${targetLocales.map((lang) => LOCALE_NAMES[lang] || lang).join(", ")}`,
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
          "X-Title": "LED ERP product translate",
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
      await sleep(RETRY_DELAYS_MS[attempt]);
      attempt += 1;
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OpenRouter API error (${response.status}): ${errorText}`
      );
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter API returned empty content");
    }

    const parsed = JSON.parse(cleanJsonText(content)) as Record<string, string>;
    return parsed;
  }
}

export async function POST(request: Request) {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as TranslateRequest;
    const { sourceLang, sourceText } = body;

    if (!isNonEmpty(sourceLang) || !isNonEmpty(sourceText)) {
      return NextResponse.json(
        { error: "Missing sourceLang or sourceText" },
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

    const translations = await translateAll(
      apiKey,
      model,
      sourceLang,
      sourceText
    );
    return NextResponse.json({ sourceLang, translations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
