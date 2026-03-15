import * as fs from "fs";
import * as path from "path";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const BASE_LOCALES = ["zh", "es"] as const;
const TARGET_LOCALES = ["en", "de", "fr", "it", "nl", "pl", "pt"] as const;
const PRIORITY_SOURCE: (typeof BASE_LOCALES)[number] = "zh";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 1000;
const TIMEOUT_MS = 60_000;
const RETRY_DELAYS_MS = [2000, 4000, 8000];
const SYSTEM_PROMPT =
  "你是一个专业的 LED 行业翻译官。请将源文本翻译成目标语言，注意专业术语：如 CCT(色温), Beam Angle(发光角度), Driver(驱动/电源)。如果是中文源，请翻译成地道的当地行业用语。";

const LOCALE_NAMES: Record<string, string> = {
  zh: "Chinese",
  es: "Spanish",
  en: "English",
  de: "German",
  fr: "French",
  it: "Italian",
  nl: "Dutch",
  pl: "Polish",
  pt: "Portuguese",
};

function readJson(filePath: string): JsonObject {
  const raw = fs.readFileSync(filePath, "utf-8");
  const content = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(content) as JsonObject;
}

function writeJson(filePath: string, data: JsonObject) {
  const content = JSON.stringify(data, null, 2) + "\n";
  fs.writeFileSync(filePath, content, "utf-8");
}

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissing(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}

function isNonEmptyString(value: JsonValue | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getValueAtPath(
  obj: JsonObject,
  pathKey: string
): JsonValue | undefined {
  const parts = pathKey.split(".");
  let current: JsonValue = obj;
  for (const part of parts) {
    if (!isPlainObject(current)) return undefined;
    current = current[part];
  }
  return current;
}

function setValueAtPath(obj: JsonObject, pathKey: string, value: JsonValue) {
  const parts = pathKey.split(".");
  let current: JsonObject = obj;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (i === parts.length - 1) {
      current[part] = value;
      return;
    }
    const next = current[part];
    if (!isPlainObject(next)) {
      current[part] = {};
    }
    current = current[part] as JsonObject;
  }
}

function collectKeyEntries(
  zh: JsonObject | undefined,
  es: JsonObject | undefined,
  prefix = ""
) {
  const zhKeys = zh ? Object.keys(zh) : [];
  const esKeys = es ? Object.keys(es) : [];
  const keys = new Set([...zhKeys, ...esKeys]);
  const entries: Array<{ path: string; zhValue?: string; esValue?: string }> =
    [];

  for (const key of Array.from(keys)) {
    const zhVal = zh ? zh[key] : undefined;
    const esVal = es ? es[key] : undefined;
    const nextPath = prefix ? `${prefix}.${key}` : key;
    const zhIsObj = isPlainObject(zhVal);
    const esIsObj = isPlainObject(esVal);

    if (zhIsObj || esIsObj) {
      entries.push(
        ...collectKeyEntries(
          zhIsObj ? (zhVal as JsonObject) : undefined,
          esIsObj ? (esVal as JsonObject) : undefined,
          nextPath
        )
      );
      continue;
    }

    const zhStr = typeof zhVal === "string" ? zhVal : undefined;
    const esStr = typeof esVal === "string" ? esVal : undefined;
    if (zhStr !== undefined || esStr !== undefined) {
      entries.push({ path: nextPath, zhValue: zhStr, esValue: esStr });
    }
  }

  return entries;
}

function resolveSource(
  zhValue?: string,
  esValue?: string
): { value: string; locale: (typeof BASE_LOCALES)[number] } | null {
  const zhHas = isNonEmptyString(zhValue);
  const esHas = isNonEmptyString(esValue);

  if (zhHas && esHas) {
    return PRIORITY_SOURCE === "zh"
      ? { value: zhValue, locale: "zh" }
      : { value: esValue, locale: "es" };
  }
  if (zhHas) return { value: zhValue, locale: "zh" };
  if (esHas) return { value: esValue, locale: "es" };
  return null;
}

function loadEnvFromFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

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

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateBatch(
  apiKey: string,
  model: string,
  sourceLocale: string,
  targetLocale: string,
  payload: Record<string, string>
) {
  const sourceName = LOCALE_NAMES[sourceLocale] || sourceLocale;
  const targetName = LOCALE_NAMES[targetLocale] || targetLocale;
  const inputJson = JSON.stringify(payload);
  const userPrompt = [
    `Source language: ${sourceName}`,
    `Target language: ${targetName}`,
    "Rules:",
    "1) Preserve placeholders like {count}, {name}, {{variable}}.",
    "2) Preserve HTML tags and line breaks.",
    "3) 你必须严格返回一个合法的 JSON 对象，不要包含任何 Markdown 代码块标签（如 ```json），不要有任何前言或后缀。确保输入的每一个 Key 都在返回的 JSON 中出现。",
    "",
    "Input JSON:",
    inputJson,
  ].join("\n");

  const response = await fetchWithTimeout(
    OPENROUTER_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "LED ERP i18n sync",
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

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(
      `OpenRouter API error (${response.status}): ${errorText}`
    );
    (error as { status?: number }).status = response.status;
    throw error;
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter API returned empty content");
  }

  return JSON.parse(cleanJsonText(content)) as Record<string, string>;
}

async function translateBatchWithRetry(
  apiKey: string,
  model: string,
  sourceLocale: string,
  targetLocale: string,
  payload: Record<string, string>
) {
  let attempt = 0;
  while (true) {
    try {
      return await translateBatch(
        apiKey,
        model,
        sourceLocale,
        targetLocale,
        payload
      );
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 429 && attempt < RETRY_DELAYS_MS.length) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        attempt += 1;
        continue;
      }
      throw error;
    }
  }
}

type TranslationTask = {
  sourceLocale: (typeof BASE_LOCALES)[number];
  targetLocale: string;
  path: string;
  value: string;
};

function buildTasks(
  entries: Array<{ path: string; zhValue?: string; esValue?: string }>,
  localeData: Record<string, JsonObject>,
  targetLocales: string[]
) {
  const tasks: TranslationTask[] = [];
  for (const entry of entries) {
    const source = resolveSource(entry.zhValue, entry.esValue);
    if (!source) continue;
    for (const targetLocale of targetLocales) {
      if (targetLocale === source.locale) continue;
      const current = getValueAtPath(localeData[targetLocale], entry.path);
      if (!isMissing(current)) continue;
      tasks.push({
        sourceLocale: source.locale,
        targetLocale,
        path: entry.path,
        value: source.value,
      });
    }
  }
  return tasks;
}

async function processTasks(
  tasks: TranslationTask[],
  localeData: Record<string, JsonObject>,
  apiKey: string,
  model: string
) {
  const changedLocales = new Set<string>();
  let appliedCount = 0;
  const grouped = new Map<string, TranslationTask[]>();

  for (const task of tasks) {
    const key = `${task.sourceLocale}::${task.targetLocale}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(task);
  }

  for (const [groupKey, groupTasks] of Array.from(grouped.entries())) {
    const [sourceLocale, targetLocale] = groupKey.split("::");
    for (let i = 0; i < groupTasks.length; i += BATCH_SIZE) {
      const batch = groupTasks.slice(i, i + BATCH_SIZE);
      const payload: Record<string, string> = {};
      for (const task of batch) {
        payload[task.path] = task.value;
      }

      const translated = await translateBatchWithRetry(
        apiKey,
        model,
        sourceLocale,
        targetLocale,
        payload
      );

      const requestKeys = Object.keys(payload);
      const responseKeys = Object.keys(translated);
      const missingKeys = requestKeys.filter((key) => !(key in translated));
      if (
        missingKeys.length > 0 ||
        responseKeys.length !== requestKeys.length
      ) {
        console.warn(
          `[${targetLocale}] batch skipped, missing keys: ${missingKeys.join(", ")}`
        );
      } else {
        for (const key of requestKeys) {
          setValueAtPath(localeData[targetLocale], key, translated[key]);
          console.log(`[${targetLocale}] ${key}`);
        }
        appliedCount += requestKeys.length;
        changedLocales.add(targetLocale);
      }

      await sleep(BATCH_DELAY_MS);
    }
  }

  return { changedLocales, appliedCount };
}

async function main() {
  loadEnvFromFile(path.join(process.cwd(), ".env"));
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL;
  if (!apiKey || !model) {
    throw new Error("Missing OPENROUTER_API_KEY or OPENROUTER_MODEL in .env");
  }

  const localeData: Record<string, JsonObject> = {};
  for (const locale of [...BASE_LOCALES, ...TARGET_LOCALES]) {
    const filePath = path.join(MESSAGES_DIR, `${locale}.json`);
    if (fs.existsSync(filePath)) {
      localeData[locale] = readJson(filePath);
    } else {
      localeData[locale] = {};
    }
  }

  const baseEntries = collectKeyEntries(localeData.zh, localeData.es);
  const baseTasks = buildTasks(baseEntries, localeData, [...BASE_LOCALES]);
  const baseResult = await processTasks(baseTasks, localeData, apiKey, model);
  for (const baseLocale of Array.from(baseResult.changedLocales)) {
    const filePath = path.join(MESSAGES_DIR, `${baseLocale}.json`);
    writeJson(filePath, localeData[baseLocale]);
  }

  const entries = collectKeyEntries(localeData.zh, localeData.es);
  const targetTasks = buildTasks(entries, localeData, [...TARGET_LOCALES]);
  const targetResult = await processTasks(
    targetTasks,
    localeData,
    apiKey,
    model
  );
  for (const targetLocale of Array.from(targetResult.changedLocales)) {
    const filePath = path.join(MESSAGES_DIR, `${targetLocale}.json`);
    writeJson(filePath, localeData[targetLocale]);
  }

  const totalTranslated = baseResult.appliedCount + targetResult.appliedCount;
  console.log(`done: ${totalTranslated} translated`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
