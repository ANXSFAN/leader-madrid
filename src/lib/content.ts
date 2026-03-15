// Type definitions for JSONB content
export type LocalizedContent = {
  en?: { name: string; description?: string };
  es?: { name: string; description?: string };
  [key: string]: { name?: string; description?: string } | string | string[] | undefined;
};

export type ProductSpecs = {
  power?: string;
  cct?: string;
  beamAngle?: string;
  cri?: string;
  ip?: string;
  lumen?: string;
  [key: string]: string | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getLocalized(content: any, lang: string = "en") {
  if (!content) return { name: "", description: "", images: [] };

  const langContent = content[lang];
  const enContent = content["en"];

  // Only use the requested locale if it has a non-empty name;
  // otherwise fall back to English (empty objects like { name: "" } are truthy
  // but should not block the fallback).
  const localized =
    (langContent?.name ? langContent : null) || enContent || langContent || {};

  const images = Array.isArray(content?.images) ? content.images : [];

  return {
    name: localized.name || "Untitled",
    description: localized.description || "",
    images,
  };
}
