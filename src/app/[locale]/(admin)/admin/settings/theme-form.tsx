"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import type { ThemeConfig } from "@/lib/actions/config";
import { updateThemeConfig } from "@/lib/actions/config";

const PRESETS: Record<string, { primary: string; accent: string; radius: string }> = {
  default: { primary: "222 47% 11%", accent: "40 90% 55%", radius: "0.5rem" },
  ocean:   { primary: "210 80% 30%", accent: "180 70% 45%", radius: "0.75rem" },
  forest:  { primary: "150 40% 25%", accent: "85 60% 50%", radius: "0.5rem" },
  sunset:  { primary: "15 80% 40%", accent: "35 95% 55%", radius: "0.75rem" },
  slate:   { primary: "220 15% 25%", accent: "220 15% 55%", radius: "0.25rem" },
};

const PRESET_LABELS: Record<string, string> = {
  default: "Default",
  ocean: "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  slate: "Slate",
};

// ── HSL ↔ Hex conversion helpers ────────────────────────────────
function hslStringToHex(hslStr: string): string {
  const parts = hslStr.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return "#1a2234";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHslString(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function radiusToSlider(r: string): number {
  return parseFloat(r) || 0.5;
}

export function ThemeForm({ initialConfig }: { initialConfig: ThemeConfig }) {
  const t = useTranslations("admin.settings");
  const [isPending, startTransition] = useTransition();
  const [config, setConfig] = useState<ThemeConfig>(initialConfig);

  const handlePreset = (name: string) => {
    const p = PRESETS[name];
    if (p) setConfig({ preset: name, ...p });
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await updateThemeConfig(config);
      if (res.success) {
        toast.success(t("theme_saved"));
      } else {
        toast.error(t("theme_save_error"));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Preset buttons */}
      <div>
        <Label className="mb-2 block">{t("theme_presets")}</Label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PRESETS).map(([name, preset]) => (
            <button
              key={name}
              type="button"
              onClick={() => handlePreset(name)}
              className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                config.preset === name
                  ? "border-ring bg-accent/10"
                  : "border-border hover:border-ring/50"
              }`}
            >
              <span
                className="inline-block h-5 w-5 rounded-full border"
                style={{ background: `hsl(${preset.primary})` }}
              />
              <span
                className="inline-block h-5 w-5 rounded-full border"
                style={{ background: `hsl(${preset.accent})` }}
              />
              <span>{PRESET_LABELS[name]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Color pickers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="mb-2 block">{t("theme_primary")}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={hslStringToHex(config.primary)}
              onChange={(e) =>
                setConfig((c) => ({ ...c, preset: "custom", primary: hexToHslString(e.target.value) }))
              }
              className="h-10 w-14 cursor-pointer rounded border border-input"
            />
            <input
              type="text"
              value={config.primary}
              onChange={(e) =>
                setConfig((c) => ({ ...c, preset: "custom", primary: e.target.value }))
              }
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="222 47% 11%"
            />
          </div>
        </div>
        <div>
          <Label className="mb-2 block">{t("theme_accent")}</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={hslStringToHex(config.accent)}
              onChange={(e) =>
                setConfig((c) => ({ ...c, preset: "custom", accent: hexToHslString(e.target.value) }))
              }
              className="h-10 w-14 cursor-pointer rounded border border-input"
            />
            <input
              type="text"
              value={config.accent}
              onChange={(e) =>
                setConfig((c) => ({ ...c, preset: "custom", accent: e.target.value }))
              }
              className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="40 90% 55%"
            />
          </div>
        </div>
      </div>

      {/* Radius slider */}
      <div>
        <Label className="mb-2 block">
          {t("theme_radius")} — {config.radius}
        </Label>
        <Slider
          min={0}
          max={1}
          step={0.125}
          value={[radiusToSlider(config.radius)]}
          onValueChange={([v]) =>
            setConfig((c) => ({ ...c, preset: "custom", radius: `${v}rem` }))
          }
          className="max-w-xs"
        />
      </div>

      {/* Live preview */}
      <div>
        <Label className="mb-2 block">{t("theme_preview")}</Label>
        <div
          className="overflow-hidden rounded-lg border border-border"
          style={
            {
              "--preview-primary": config.primary,
              "--preview-accent": config.accent,
              "--preview-radius": config.radius,
            } as React.CSSProperties
          }
        >
          <div
            className="p-4"
            style={{ background: `hsl(${config.primary})`, borderRadius: `var(--preview-radius)` }}
          >
            <p className="text-sm font-semibold" style={{ color: "hsl(40 33% 96%)" }}>
              {t("theme_preview_heading")}
            </p>
            <p className="mt-1 text-xs" style={{ color: "hsl(40 33% 96% / 0.7)" }}>
              {t("theme_preview_text")}
            </p>
          </div>
          <div className="flex items-center gap-3 p-4">
            <button
              type="button"
              className="rounded px-4 py-2 text-sm font-medium text-white"
              style={{
                background: `hsl(${config.accent})`,
                borderRadius: `var(--preview-radius)`,
              }}
            >
              {t("theme_preview_button")}
            </button>
            <button
              type="button"
              className="rounded border px-4 py-2 text-sm font-medium"
              style={{
                borderColor: `hsl(${config.primary})`,
                color: `hsl(${config.primary})`,
                borderRadius: `var(--preview-radius)`,
              }}
            >
              {t("theme_preview_outline")}
            </button>
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: `hsl(${config.accent})` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? t("theme_saving") : t("theme_save")}
        </Button>
        <Button
          variant="outline"
          onClick={() => handlePreset("default")}
          disabled={isPending || config.preset === "default"}
        >
          {t("theme_reset")}
        </Button>
      </div>
    </div>
  );
}
