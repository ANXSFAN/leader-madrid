"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateGlobalConfig } from "@/lib/actions/config";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Upload, Languages, ChevronDown, ChevronRight } from "lucide-react";
import type { MegaMenuData, MegaMenuColumn, MegaMenuItem, MegaMenuPromo } from "@/lib/types/mega-menu";

const PRIMARY_LOCALE = "zh";
const LOCALES = ["zh", "en", "es", "fr", "de", "it", "pt", "nl", "pl"];
const OTHER_LOCALES = LOCALES.slice(1); // all except primary

interface MegaMenuFormProps {
  configKey: string;
  initialData: MegaMenuData | null;
  menuType: "solutions" | "resources";
}

/* ─── Locale fields with collapsible other languages ─── */

function LocaleFields({
  label,
  values,
  onChange,
  translating,
  onTranslate,
  inputSize = "default",
}: {
  label: string;
  values: Record<string, string>;
  onChange: (locale: string, value: string) => void;
  translating: boolean;
  onTranslate: () => void;
  inputSize?: "default" | "small";
}) {
  const t = useTranslations("admin.cms.megaMenus");
  const [open, setOpen] = useState(false);
  const filledCount = OTHER_LOCALES.filter((loc) => values[loc]?.trim()).length;
  const h = inputSize === "small" ? "h-7 text-sm" : "h-8 text-sm";

  return (
    <div className="space-y-1.5">
      {/* EN row: label + EN input + AI button + expand toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0">{label}</Label>
        <Input
          value={values[PRIMARY_LOCALE] || ""}
          onChange={(e) => onChange(PRIMARY_LOCALE, e.target.value)}
          className={`${h} max-w-xs`}
          placeholder={`${label} (${PRIMARY_LOCALE.toUpperCase()})`}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-1 text-[10px] text-accent hover:text-accent hover:bg-accent/10 shrink-0"
          disabled={translating}
          title={t("auto_translate")}
          onClick={onTranslate}
        >
          {translating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Languages className="h-3 w-3" />
          )}
          AI
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-1 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setOpen(!open)}
        >
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className={filledCount > 0 ? "text-green-600" : ""}>
            {filledCount}/{OTHER_LOCALES.length}
          </span>
        </Button>
      </div>

      {/* Collapsible other locales */}
      {open && (
        <div className="grid grid-cols-4 gap-2 pl-0 pt-1 pb-1 border-l-2 border-border ml-1 pl-3">
          {OTHER_LOCALES.map((loc) => (
            <div key={loc}>
              <Label className="text-[10px] text-muted-foreground uppercase">{loc}</Label>
              <Input
                value={values[loc] || ""}
                onChange={(e) => onChange(loc, e.target.value)}
                className={h}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main form ─── */

export function MegaMenuForm({ configKey, initialData, menuType }: MegaMenuFormProps) {
  const t = useTranslations("admin.cms.megaMenus");
  const [loading, setLoading] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [columns, setColumns] = useState<MegaMenuColumn[]>(
    initialData?.columns || []
  );
  const [promo, setPromo] = useState<MegaMenuPromo>(
    initialData?.promo || {
      badge: { zh: "" },
      heading: { zh: "" },
      buttonText: { zh: "" },
      buttonHref: "/contact",
    }
  );

  const addColumn = () => {
    setColumns([...columns, { title: { zh: "" }, items: [] }]);
  };

  const removeColumn = (idx: number) => {
    setColumns(columns.filter((_, i) => i !== idx));
  };

  const updateColumnTitle = (colIdx: number, locale: string, value: string) => {
    const newCols = [...columns];
    newCols[colIdx] = {
      ...newCols[colIdx],
      title: { ...newCols[colIdx].title, [locale]: value },
    };
    setColumns(newCols);
  };

  const addItem = (colIdx: number) => {
    const newCols = [...columns];
    const newItem: MegaMenuItem = menuType === "solutions"
      ? { label: { zh: "" }, pageSlug: "" }
      : { label: { zh: "" }, href: "" };
    newCols[colIdx].items.push(newItem);
    setColumns([...newCols]);
  };

  const removeItem = (colIdx: number, itemIdx: number) => {
    const newCols = [...columns];
    newCols[colIdx].items.splice(itemIdx, 1);
    setColumns([...newCols]);
  };

  const updateItem = (
    colIdx: number,
    itemIdx: number,
    field: "label" | "pageSlug" | "href",
    value: string,
    locale?: string
  ) => {
    const newCols = [...columns];
    if (field === "label" && locale) {
      newCols[colIdx].items[itemIdx] = {
        ...newCols[colIdx].items[itemIdx],
        label: {
          ...newCols[colIdx].items[itemIdx].label,
          [locale]: value,
        },
      };
    } else if (field === "pageSlug") {
      newCols[colIdx].items[itemIdx] = {
        ...newCols[colIdx].items[itemIdx],
        pageSlug: value,
      };
    } else if (field === "href") {
      newCols[colIdx].items[itemIdx] = {
        ...newCols[colIdx].items[itemIdx],
        href: value,
      };
    }
    setColumns([...newCols]);
  };

  const updatePromoField = (field: keyof MegaMenuPromo, value: string, locale?: string) => {
    if (field === "buttonHref") {
      setPromo((prev) => ({ ...prev, buttonHref: value }));
    } else if (locale) {
      setPromo((prev) => ({
        ...prev,
        [field]: { ...(prev[field] as Record<string, string>), [locale]: value },
      }));
    }
  };

  const autoTranslate = async (
    values: Record<string, string>,
    key: string,
    onResult: (merged: Record<string, string>) => void
  ) => {
    const source = LOCALES.find((loc) => values[loc]?.trim());
    if (!source) {
      toast.error(t("translate_no_source"));
      return;
    }
    setTranslatingKey(key);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLang: source, sourceText: values[source] }),
      });
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const merged = { ...values };
      for (const loc of LOCALES) {
        if (loc === source) continue;
        if (!merged[loc]?.trim() && data.translations[loc]) {
          merged[loc] = data.translations[loc];
        }
      }
      onResult(merged);
      toast.success(t("translate_done"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setTranslatingKey(null);
    }
  };

  const handleFileUpload = async (colIdx: number, itemIdx: number, file: File) => {
    const key = `${colIdx}-${itemIdx}`;
    setUploadingItem(key);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("path", "cms-documents");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      updateItem(colIdx, itemIdx, "href", data.url);
      toast.success(t("upload_success"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setUploadingItem(null);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const data: MegaMenuData = { columns, promo };
      const result = await updateGlobalConfig(configKey, data);
      if (result.success) {
        toast.success(t("save_success"));
      } else {
        toast.error(t("save_error"));
      }
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Columns */}
      {columns.map((col, colIdx) => (
        <Card key={colIdx} className="hover:shadow-md transition-all duration-200">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="border-l-4 border-accent pl-3 text-sm">
                {t("column")} {colIdx + 1}
              </CardTitle>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => removeColumn(colIdx)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Column Title */}
            <LocaleFields
              label={t("column_title")}
              values={col.title}
              onChange={(loc, val) => updateColumnTitle(colIdx, loc, val)}
              translating={translatingKey === `col-${colIdx}-title`}
              onTranslate={() =>
                autoTranslate(col.title, `col-${colIdx}-title`, (merged) => {
                  const newCols = [...columns];
                  newCols[colIdx] = { ...newCols[colIdx], title: merged };
                  setColumns(newCols);
                })
              }
            />

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">{t("menu_items")}</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(colIdx)}>
                  <Plus className="h-3 w-3 mr-1" /> {t("add_item")}
                </Button>
              </div>
              {col.items.map((item, itemIdx) => (
                <div key={itemIdx} className="flex gap-2 items-start p-2 bg-secondary rounded border">
                  <div className="flex-1 space-y-2">
                    {/* Item label */}
                    <LocaleFields
                      label={t("label")}
                      values={item.label}
                      onChange={(loc, val) => updateItem(colIdx, itemIdx, "label", val, loc)}
                      translating={translatingKey === `col-${colIdx}-item-${itemIdx}`}
                      onTranslate={() =>
                        autoTranslate(item.label, `col-${colIdx}-item-${itemIdx}`, (merged) => {
                          const newCols = [...columns];
                          newCols[colIdx].items[itemIdx] = {
                            ...newCols[colIdx].items[itemIdx],
                            label: merged,
                          };
                          setColumns([...newCols]);
                        })
                      }
                      inputSize="small"
                    />
                    {/* Link field: pageSlug for solutions, href for resources */}
                    <div className="flex items-center gap-2">
                      {menuType === "solutions" ? (
                        <>
                          <Label className="text-xs shrink-0">{t("page_slug")}</Label>
                          <Input
                            value={item.pageSlug || ""}
                            onChange={(e) => updateItem(colIdx, itemIdx, "pageSlug", e.target.value)}
                            className="h-7 text-sm max-w-xs"
                            placeholder="slug"
                          />
                        </>
                      ) : (
                        <>
                          <Label className="text-xs shrink-0">{t("upload_or_paste")}</Label>
                          <div className="flex gap-1 max-w-xs">
                            <Input
                              value={item.href || ""}
                              onChange={(e) => updateItem(colIdx, itemIdx, "href", e.target.value)}
                              className="h-7 text-sm"
                              placeholder="https://..."
                            />
                            <label className="shrink-0">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(colIdx, itemIdx, file);
                                  e.target.value = "";
                                }}
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                disabled={uploadingItem === `${colIdx}-${itemIdx}`}
                                onClick={(e) => {
                                  const input = (e.currentTarget as HTMLElement).parentElement?.querySelector("input[type=file]") as HTMLInputElement;
                                  input?.click();
                                }}
                              >
                                {uploadingItem === `${colIdx}-${itemIdx}` ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Upload className="h-3 w-3" />
                                )}
                              </Button>
                            </label>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 mt-1 text-destructive/70 hover:text-destructive"
                    onClick={() => removeItem(colIdx, itemIdx)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addColumn}>
        <Plus className="h-4 w-4 mr-2" /> {t("add_column")}
      </Button>

      {/* Promo Card */}
      <Card className="hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="border-l-4 border-accent pl-3 text-sm">{t("promo_card")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <LocaleFields
            label={t("promo_badge")}
            values={promo.badge || {}}
            onChange={(loc, val) => updatePromoField("badge", val, loc)}
            translating={translatingKey === "promo-badge"}
            onTranslate={() =>
              autoTranslate(promo.badge || {}, "promo-badge", (merged) =>
                setPromo((prev) => ({ ...prev, badge: merged }))
              )
            }
          />
          <LocaleFields
            label={t("promo_heading")}
            values={promo.heading || {}}
            onChange={(loc, val) => updatePromoField("heading", val, loc)}
            translating={translatingKey === "promo-heading"}
            onTranslate={() =>
              autoTranslate(promo.heading || {}, "promo-heading", (merged) =>
                setPromo((prev) => ({ ...prev, heading: merged }))
              )
            }
          />
          <LocaleFields
            label={t("promo_button_text")}
            values={promo.buttonText || {}}
            onChange={(loc, val) => updatePromoField("buttonText", val, loc)}
            translating={translatingKey === "promo-buttonText"}
            onTranslate={() =>
              autoTranslate(promo.buttonText || {}, "promo-buttonText", (merged) =>
                setPromo((prev) => ({ ...prev, buttonText: merged }))
              )
            }
          />
          {/* Button Link */}
          <div className="flex items-center gap-2">
            <Label className="text-xs shrink-0">{t("button_link")}</Label>
            <Input
              value={promo.buttonHref}
              onChange={(e) => updatePromoField("buttonHref", e.target.value)}
              className="h-8 text-sm max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={loading}
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("save_config")}
        </Button>
      </div>
    </div>
  );
}
