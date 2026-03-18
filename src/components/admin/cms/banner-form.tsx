"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBanner,
  updateBanner,
  BannerData,
  BannerContent,
  LocalizedString,
} from "@/lib/actions/cms";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/image-upload";
import { Loader2, Plus, Trash2, ArrowLeft, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import type { Banner } from "@prisma/client";

interface BannerFormProps {
  initialData?: Banner;
}

const AVAILABLE_ICONS = [
  "ShieldCheck",
  "Zap",
  "BarChart3",
  "FileDown",
  "ArrowRight",
  "CheckCircle",
  "Truck",
  "Globe",
];

const BUTTON_VARIANTS = [
  { value: "primary", label: "Primary (Yellow)" },
  { value: "outline", label: "Outline (White)" },
];

const LOCALES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "zh"];

// ─── Internal form types (localized text stored as Record<string, string>) ───

interface FormButton {
  textValues: Record<string, string>;
  link: string;
  variant: string;
}

interface FormStat {
  valueValues: Record<string, string>;
  labelValues: Record<string, string>;
  icon: string;
}

/** Helper: build a localized record from per-locale state */
function buildLocalizedRecord(values: Record<string, string>): Record<string, string> {
  const record: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v.trim()) record[k] = v;
  }
  return record;
}

/** Helper: initialize a Record<string, string> from a LocalizedString (backward compat) */
function initLocalized(val: LocalizedString | undefined): Record<string, string> {
  if (!val) return {};
  if (typeof val === "string") return val ? { en: val } : {};
  return { ...val } as Record<string, string>;
}

export function BannerForm({ initialData }: BannerFormProps) {
  const router = useRouter();
  const t = useTranslations("admin.cms.banners");
  const [loading, setLoading] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [activeLocale, setActiveLocale] = useState("en");
  const isEditing = !!initialData;

  // Basic Fields
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Content Fields (multilingual)
  const [badgeValues, setBadgeValues] = useState<Record<string, string>>({});
  const [headingValues, setHeadingValues] = useState<Record<string, string>>({});
  const [descriptionValues, setDescriptionValues] = useState<Record<string, string>>({});

  const [highlightColor, setHighlightColor] = useState("text-yellow-500");
  const [alignment, setAlignment] = useState<"left" | "center">("left");

  // Dynamic Lists (localized)
  const [formButtons, setFormButtons] = useState<FormButton[]>([]);
  const [formStats, setFormStats] = useState<FormStat[]>([]);

  // Initialize form when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setImageUrl(initialData.imageUrl || "");
      setIsActive(initialData.isActive ?? true);
      const content = (initialData.content || {}) as BannerContent;

      setBadgeValues(initLocalized(content.badge));
      setHeadingValues(initLocalized(content.heading));
      setDescriptionValues(initLocalized(content.description));
      setHighlightColor(content.highlightColor || "text-yellow-500");
      setAlignment(content.alignment || "left");

      // Initialize buttons with localized text (backward compat: string → { en: string })
      setFormButtons(
        (content.buttons || []).map((btn) => ({
          textValues: initLocalized(btn.text),
          link: btn.link || "/",
          variant: btn.variant || "outline",
        }))
      );
      // Initialize stats with localized value/label
      setFormStats(
        (content.stats || []).map((stat) => ({
          valueValues: initLocalized(stat.value),
          labelValues: initLocalized(stat.label),
          icon: stat.icon || "CheckCircle",
        }))
      );
    } else {
      // Reset for create
      setTitle("");
      setImageUrl("");
      setBadgeValues({});
      setHeadingValues({});
      setDescriptionValues({});
      setHighlightColor("text-yellow-500");
      setAlignment("left");
      setIsActive(true);
      setFormButtons([
        { textValues: { en: "View Products", zh: "查看产品" }, link: "/products", variant: "primary" },
      ]);
      setFormStats([]);
    }
  }, [initialData]);

  // ─── AI Translation helpers ───

  /** Translate a single text field and return translations */
  const translateOne = async (
    sourceLang: string,
    sourceText: string
  ): Promise<Record<string, string>> => {
    const res = await fetch("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceLang, sourceText }),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as { translations: Record<string, string> };
    return data.translations;
  };

  /** Merge translations into existing values (only fill empty slots) */
  const mergeTranslations = (
    prev: Record<string, string>,
    translations: Record<string, string>,
    sourceLang: string,
    sourceText: string
  ): Record<string, string> => {
    const updated = { ...prev };
    for (const [lang, val] of Object.entries(translations)) {
      if (!prev[lang]?.trim()) updated[lang] = val;
    }
    if (!updated[sourceLang]?.trim()) updated[sourceLang] = sourceText;
    return updated;
  };

  /** AI Translate — Text tab fields (badge, heading, description) */
  const runAiTranslateText = async (sourceLang: string) => {
    const sourceValues = {
      badge: badgeValues[sourceLang],
      heading: headingValues[sourceLang],
      description: descriptionValues[sourceLang],
    };
    const hasAny = Object.values(sourceValues).some((v) => v?.trim());
    if (!hasAny) {
      toast.error(t("ai_no_source"));
      return;
    }
    setAiTranslating(true);
    try {
      if (sourceValues.badge?.trim()) {
        const tr = await translateOne(sourceLang, sourceValues.badge);
        setBadgeValues((prev) => mergeTranslations(prev, tr, sourceLang, sourceValues.badge));
      }
      if (sourceValues.heading?.trim()) {
        const tr = await translateOne(sourceLang, sourceValues.heading);
        setHeadingValues((prev) => mergeTranslations(prev, tr, sourceLang, sourceValues.heading));
      }
      if (sourceValues.description?.trim()) {
        const tr = await translateOne(sourceLang, sourceValues.description);
        setDescriptionValues((prev) => mergeTranslations(prev, tr, sourceLang, sourceValues.description));
      }
      toast.success(t("ai_translate_success"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setAiTranslating(false);
    }
  };

  /** AI Translate — Actions tab (button texts) */
  const runAiTranslateActions = async (sourceLang: string) => {
    const hasAny = formButtons.some((btn) => btn.textValues[sourceLang]?.trim());
    if (!hasAny) {
      toast.error(t("ai_no_source"));
      return;
    }
    setAiTranslating(true);
    try {
      const newButtons = [...formButtons];
      for (let i = 0; i < newButtons.length; i++) {
        const sourceText = newButtons[i].textValues[sourceLang];
        if (!sourceText?.trim()) continue;
        const tr = await translateOne(sourceLang, sourceText);
        newButtons[i] = {
          ...newButtons[i],
          textValues: mergeTranslations(newButtons[i].textValues, tr, sourceLang, sourceText),
        };
      }
      setFormButtons(newButtons);
      toast.success(t("ai_translate_success"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setAiTranslating(false);
    }
  };

  /** AI Translate — Stats tab (stat values and labels) */
  const runAiTranslateStats = async (sourceLang: string) => {
    const hasAny = formStats.some(
      (s) => s.valueValues[sourceLang]?.trim() || s.labelValues[sourceLang]?.trim()
    );
    if (!hasAny) {
      toast.error(t("ai_no_source"));
      return;
    }
    setAiTranslating(true);
    try {
      const newStats = [...formStats];
      for (let i = 0; i < newStats.length; i++) {
        const srcVal = newStats[i].valueValues[sourceLang];
        const srcLabel = newStats[i].labelValues[sourceLang];
        let updatedStat = { ...newStats[i] };
        if (srcVal?.trim()) {
          const tr = await translateOne(sourceLang, srcVal);
          updatedStat.valueValues = mergeTranslations(updatedStat.valueValues, tr, sourceLang, srcVal);
        }
        if (srcLabel?.trim()) {
          const tr = await translateOne(sourceLang, srcLabel);
          updatedStat.labelValues = mergeTranslations(updatedStat.labelValues, tr, sourceLang, srcLabel);
        }
        newStats[i] = updatedStat;
      }
      setFormStats(newStats);
      toast.success(t("ai_translate_success"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setAiTranslating(false);
    }
  };

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const content: BannerContent = {
        badge: buildLocalizedRecord(badgeValues),
        heading: buildLocalizedRecord(headingValues),
        highlightColor,
        description: buildLocalizedRecord(descriptionValues),
        buttons: formButtons.map((btn) => ({
          text: buildLocalizedRecord(btn.textValues),
          link: btn.link,
          variant: btn.variant as "primary" | "outline",
        })),
        stats: formStats.map((stat) => ({
          value: buildLocalizedRecord(stat.valueValues),
          label: buildLocalizedRecord(stat.labelValues),
          icon: stat.icon,
        })),
        alignment,
      };
      const data: BannerData = {
        title,
        imageUrl,
        isActive,
        content,
      };

      if (isEditing) {
        await updateBanner(initialData.id, data);
        toast.success(t("banner_updated"));
      } else {
        await createBanner(data);
        toast.success(t("banner_created"));
      }
      router.push("/admin/cms/banners");
    } catch (error) {
      console.error(error);
      toast.error(t("something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  // ─── Button CRUD ───

  const addButton = () => {
    if (formButtons.length >= 2) return;
    setFormButtons([
      ...formButtons,
      { textValues: { en: "Button" }, link: "/", variant: "outline" },
    ]);
  };

  const removeButton = (index: number) => {
    setFormButtons(formButtons.filter((_, i) => i !== index));
  };

  const updateButtonText = (index: number, locale: string, value: string) => {
    setFormButtons((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        textValues: { ...updated[index].textValues, [locale]: value },
      };
      return updated;
    });
  };

  const updateButtonField = (index: number, field: "link" | "variant", value: string) => {
    setFormButtons((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // ─── Stat CRUD ───

  const addStat = () => {
    if (formStats.length >= 4) return;
    setFormStats([
      ...formStats,
      { valueValues: { en: "100%" }, labelValues: { en: "Quality" }, icon: "CheckCircle" },
    ]);
  };

  const updateStatText = (
    index: number,
    field: "valueValues" | "labelValues",
    locale: string,
    value: string
  ) => {
    setFormStats((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: { ...updated[index][field], [locale]: value },
      };
      return updated;
    });
  };

  const updateStatIcon = (index: number, value: string) => {
    setFormStats((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], icon: value };
      return updated;
    });
  };

  const removeStat = (index: number) => {
    setFormStats(formStats.filter((_, i) => i !== index));
  };

  // ─── Reusable locale tab strip ───

  const LocaleTabStrip = ({ onTranslate }: { onTranslate: (lang: string) => void }) => (
    <div className="flex items-center justify-between gap-2 mb-4">
      <Tabs value={activeLocale} onValueChange={setActiveLocale}>
        <TabsList className="flex flex-wrap gap-1">
          {LOCALES.map((loc) => (
            <TabsTrigger key={loc} value={loc} className="uppercase text-xs">
              {loc}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={aiTranslating}
        onClick={() => onTranslate(activeLocale)}
      >
        {aiTranslating ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ai_translating")}</>
        ) : (
          <><Wand2 className="h-4 w-4 mr-2" />{t("ai_translate")}</>
        )}
      </Button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs defaultValue="visual" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted p-1">
          <TabsTrigger value="visual">{t("tab_visual")}</TabsTrigger>
          <TabsTrigger value="text">{t("tab_text")}</TabsTrigger>
          <TabsTrigger value="actions">{t("tab_actions")}</TabsTrigger>
          <TabsTrigger value="stats">{t("tab_stats")}</TabsTrigger>
        </TabsList>

        {/* Tab 1: Visual */}
        <TabsContent value="visual" className="pt-4">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">
                {t("visual_title")}
              </CardTitle>
              <CardDescription>
                {t("visual_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t("banner_image")}</Label>
                <ImageUpload
                  value={imageUrl ? [imageUrl] : []}
                  onChange={(urls) =>
                    setImageUrl(urls.length > 0 ? urls[0] : "")
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">{t("internal_title")}</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("internal_title_placeholder")}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>{t("content_alignment")}</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={alignment === "left" ? "default" : "outline"}
                    onClick={() => setAlignment("left")}
                    className={cn(alignment === "left" ? "bg-slate-900" : "")}
                  >
                    {t("left_aligned")}
                  </Button>
                  <Button
                    type="button"
                    variant={alignment === "center" ? "default" : "outline"}
                    onClick={() => setAlignment("center")}
                    className={cn(
                      alignment === "center" ? "bg-slate-900" : ""
                    )}
                  >
                    {t("center_aligned")}
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="active">{t("active_status")}</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Text (Multilingual) */}
        <TabsContent value="text" className="pt-4">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">
                {t("text_title")}
              </CardTitle>
              <CardDescription>
                {t("text_description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* AI Translate Button */}
              <div className="flex justify-end mb-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={aiTranslating}
                  onClick={() => void runAiTranslateText(activeLocale)}
                >
                  {aiTranslating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("ai_translating")}</>
                  ) : (
                    <><Wand2 className="h-4 w-4 mr-2" />{t("ai_translate")}</>
                  )}
                </Button>
              </div>
              <Tabs value={activeLocale} onValueChange={setActiveLocale}>
                <TabsList className="flex flex-wrap gap-1 mb-4">
                  {LOCALES.map((loc) => (
                    <TabsTrigger key={loc} value={loc} className="uppercase text-xs">
                      {loc}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {LOCALES.map((loc) => (
                  <TabsContent key={loc} value={loc} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("top_badge", { locale: loc.toUpperCase() })}</Label>
                      <Input
                        value={badgeValues[loc] || ""}
                        onChange={(e) =>
                          setBadgeValues((prev) => ({ ...prev, [loc]: e.target.value }))
                        }
                        placeholder={t("top_badge_placeholder")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>
                        {t("main_heading", { locale: loc.toUpperCase() })}
                      </Label>
                      <div className="text-xs text-muted-foreground mb-1">
                        {t("heading_hint")}
                      </div>
                      <Textarea
                        value={headingValues[loc] || ""}
                        onChange={(e) =>
                          setHeadingValues((prev) => ({ ...prev, [loc]: e.target.value }))
                        }
                        placeholder={t("heading_placeholder", { locale: loc })}
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("description_label", { locale: loc.toUpperCase() })}</Label>
                      <Textarea
                        value={descriptionValues[loc] || ""}
                        onChange={(e) =>
                          setDescriptionValues((prev) => ({ ...prev, [loc]: e.target.value }))
                        }
                        placeholder={t("description_placeholder", { locale: loc })}
                        rows={3}
                      />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>

              <div className="space-y-2 mt-4 pt-4 border-t">
                <Label htmlFor="highlightColor">{t("highlight_color")}</Label>
                <Input
                  id="highlightColor"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  placeholder="text-yellow-500"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Actions (Buttons) — Multilingual */}
        <TabsContent value="actions" className="pt-4">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="border-l-4 border-accent pl-3">
                    {t("actions_title")}
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {t("actions_description")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addButton}
                  disabled={formButtons.length >= 2}
                >
                  <Plus className="h-4 w-4 mr-1" /> {t("add_button")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formButtons.length > 0 && (
                <LocaleTabStrip onTranslate={(lang) => void runAiTranslateActions(lang)} />
              )}

              {formButtons.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t("no_buttons")}
                </div>
              )}
              {formButtons.map((btn, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 bg-secondary rounded-md border"
                >
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div>
                      <Label className="text-xs mb-1 block">
                        {t("button_text")} ({activeLocale.toUpperCase()})
                      </Label>
                      <Input
                        value={btn.textValues[activeLocale] || ""}
                        onChange={(e) => updateButtonText(index, activeLocale, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">{t("button_link")}</Label>
                      <Input
                        value={btn.link}
                        onChange={(e) => updateButtonField(index, "link", e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">{t("button_style")}</Label>
                      <Select
                        value={btn.variant}
                        onValueChange={(val) => updateButtonField(index, "variant", val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BUTTON_VARIANTS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.value === "primary" ? t("variant_primary") : t("variant_outline")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeButton(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Stats — Multilingual */}
        <TabsContent value="stats" className="pt-4">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="border-l-4 border-accent pl-3">
                    {t("stats_title")}
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    {t("stats_description")}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addStat}
                  disabled={formStats.length >= 4}
                >
                  <Plus className="h-4 w-4 mr-1" /> {t("add_stat")}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formStats.length > 0 && (
                <LocaleTabStrip onTranslate={(lang) => void runAiTranslateStats(lang)} />
              )}

              {formStats.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {t("no_stats")}
                </div>
              )}
              {formStats.map((stat, index) => (
                <div
                  key={index}
                  className="flex gap-2 items-start p-3 bg-secondary rounded-md border"
                >
                  <div className="grid grid-cols-3 gap-2 flex-1">
                    <div>
                      <Label className="text-xs mb-1 block">
                        {t("stat_value")} ({activeLocale.toUpperCase()})
                      </Label>
                      <Input
                        value={stat.valueValues[activeLocale] || ""}
                        onChange={(e) => updateStatText(index, "valueValues", activeLocale, e.target.value)}
                        placeholder="e.g. 5 Years"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">
                        {t("stat_label")} ({activeLocale.toUpperCase()})
                      </Label>
                      <Input
                        value={stat.labelValues[activeLocale] || ""}
                        onChange={(e) => updateStatText(index, "labelValues", activeLocale, e.target.value)}
                        placeholder="e.g. Warranty"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">{t("stat_icon")}</Label>
                      <Select
                        value={stat.icon}
                        onValueChange={(val) => updateStatIcon(index, val)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AVAILABLE_ICONS.map((icon) => (
                            <SelectItem key={icon} value={icon}>
                              {icon}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mt-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removeStat(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Link href="/admin/cms/banners">
          <Button type="button" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("back_to_banners")}
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={loading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("update_banner") : t("create_banner")}
        </Button>
      </div>
    </form>
  );
}
