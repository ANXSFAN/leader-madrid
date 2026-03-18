"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttributeDefinition, AttributeOption } from "@prisma/client";
import {
  createAttribute,
  updateAttribute,
  addAttributeOption,
  deleteAttributeOption,
} from "@/lib/actions/attributes";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Wand2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "next-intl";

const SUPPORTED_LOCALES = [
  "en",
  "es",
  "zh",
  "fr",
  "de",
  "it",
  "pt",
  "nl",
  "pl",
] as const;

const localizedSchema = z.object({
  name: z.string().optional(),
});

const formSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(/^[a-z0-9_]+$/, "Key must be lowercase, numbers, or underscores"),
  type: z.enum(["TEXT", "NUMBER", "SELECT"]),
  unit: z.string().optional(),
  scope: z.enum(["PRODUCT", "VARIANT"]),
  isHighlight: z.boolean().default(false),
  isFilterable: z.boolean().default(false),
  locales: z.object(
    SUPPORTED_LOCALES.reduce((acc, locale) => {
      acc[locale] =
        locale === "en" || locale === "es"
          ? (localizedSchema.extend({
              name: z.string().min(1, `Name (${locale.toUpperCase()}) is required`),
            }) as unknown as typeof localizedSchema)
          : localizedSchema;
      return acc;
    }, {} as Record<string, typeof localizedSchema>)
  ),
});

interface AttributeFormProps {
  initialData?: AttributeDefinition & { options: AttributeOption[] };
}

export function AttributeForm({ initialData }: AttributeFormProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tp = useTranslations("admin.products.form.buttons");
  const [loading, setLoading] = useState(false);
  const [newOption, setNewOption] = useState("");
  const [newColor, setNewColor] = useState("");
  const [activeLangTab, setActiveLangTab] = useState("en");
  const [aiTranslating, setAiTranslating] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          key: initialData.key,
          type: initialData.type as "TEXT" | "NUMBER" | "SELECT",
          unit: initialData.unit || "",
          scope: initialData.scope as "PRODUCT" | "VARIANT",
          isHighlight: initialData.isHighlight ?? false,
          isFilterable: initialData.isFilterable ?? false,
          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            const nameObj = initialData.name as Record<string, string>;
            acc[locale] = {
              name: nameObj?.[locale] || "",
            };
            return acc;
          }, {} as Record<string, { name: string }>),
        }
      : {
          key: "",
          type: "TEXT" as const,
          unit: "",
          scope: "PRODUCT" as const,
          isHighlight: false,
          isFilterable: false,
          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            acc[locale] = { name: "" };
            return acc;
          }, {} as Record<string, { name: string }>),
        },
  });

  // --- AI Translation logic ---

  const isBlank = (v: unknown): v is undefined | null | "" =>
    v === undefined || v === null || v === "";

  const getLocaleNameValue = (locale: string): string =>
    (form.getValues(`locales.${locale}.name` as `locales.${string}.name`) as string) ?? "";

  const runAiTranslate = async () => {
    const sourceLang = activeLangTab;
    const sourceText = getLocaleNameValue(sourceLang);

    if (isBlank(sourceText)) {
      toast.error(tp("ai_translate_no_source"));
      return;
    }

    setAiTranslating(true);
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceLang, sourceText }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "AI translate failed");
      }

      const data = (await response.json()) as {
        translations?: Record<string, string>;
      };
      const translations = data.translations || {};

      for (const locale of SUPPORTED_LOCALES) {
        if (locale === sourceLang) continue;
        const current = getLocaleNameValue(locale);
        if (!isBlank(current)) continue;
        const translated = translations[locale];
        if (isBlank(translated)) continue;
        form.setValue(`locales.${locale}.name` as `locales.${string}.name`, translated, {
          shouldDirty: true,
        });
      }

      toast.success(tp("ai_success"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("common.messages.something_went_wrong");
      toast.error(message);
    } finally {
      setAiTranslating(false);
    }
  };

  // --- Form submit ---

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      setLoading(true);
      // Flatten locales to { en: "...", es: "...", zh: "..." }
      const name: Record<string, string> = {};
      for (const locale of SUPPORTED_LOCALES) {
        const val = values.locales[locale]?.name;
        if (val) name[locale] = val;
      }

      const data = {
        name,
        key: values.key,
        type: values.type,
        unit: values.unit,
        scope: values.scope,
        isHighlight: values.isHighlight,
        isFilterable: values.isFilterable,
      };

      if (initialData) {
        const res = await updateAttribute(initialData.id, data);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(t("attributes.form.toast.updated"));
          router.push("/admin/attributes");
          router.refresh();
        }
      } else {
        const res = await createAttribute(data);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success(t("attributes.form.toast.created"));
          router.push("/admin/attributes");
          router.refresh();
        }
      }
    } catch (error) {
      toast.error(t("common.messages.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  }

  const handleAddOption = async () => {
    if (!initialData || !newOption.trim()) return;
    try {
      const res = await addAttributeOption(initialData.id, newOption, newColor);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("attributes.form.options.toast_added"));
        setNewOption("");
        setNewColor("");
        router.refresh();
      }
    } catch (error) {
      toast.error(t("common.messages.something_went_wrong"));
    }
  };

  const handleDeleteOption = async (id: string) => {
    try {
      const res = await deleteAttributeOption(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(t("attributes.form.options.toast_deleted"));
        router.refresh();
      }
    } catch (error) {
      toast.error(t("common.messages.something_went_wrong"));
    }
  };

  return (
    <div className="space-y-8">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Left column: basic fields */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-accent pl-3">{t("attributes.form.fields.key")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="key"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("attributes.form.fields.key")}</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="power_consumption"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("attributes.form.fields.scope")}</FormLabel>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card">
                            <SelectValue
                              defaultValue={field.value}
                              placeholder="Select a scope"
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card">
                          <SelectItem value="PRODUCT">
                            {t("attributes.form.scopes.product")}
                          </SelectItem>
                          <SelectItem value="VARIANT">
                            {t("attributes.form.scopes.variant")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("attributes.form.fields.type")}</FormLabel>
                      <Select
                        disabled={loading}
                        onValueChange={field.onChange}
                        value={field.value}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-card">
                            <SelectValue
                              defaultValue={field.value}
                              placeholder="Select a type"
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-card">
                          <SelectItem value="TEXT">
                            {t("attributes.form.types.text")}
                          </SelectItem>
                          <SelectItem value="NUMBER">
                            {t("attributes.form.types.number")}
                          </SelectItem>
                          <SelectItem value="SELECT">
                            {t("attributes.form.types.select")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("attributes.form.fields.unit")}</FormLabel>
                      <FormControl>
                        <Input
                          disabled={loading}
                          placeholder="W, lm, K..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isHighlight"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("attributes.form.fields.is_highlight")}
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("attributes.form.fields.is_highlight_desc")}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={loading}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isFilterable"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm font-medium">
                          {t("attributes.form.fields.is_filterable")}
                        </FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {t("attributes.form.fields.is_filterable_desc")}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={loading}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Right column: localized names */}
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-accent pl-3">{t("categories.fields.localized_names")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeLangTab} onValueChange={setActiveLangTab}>
                  <div className="flex justify-end pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={runAiTranslate}
                      disabled={aiTranslating}
                    >
                      <Wand2 className="h-4 w-4 mr-2" />
                      {aiTranslating ? tp("ai_translating") : tp("ai_translate")}
                    </Button>
                  </div>
                  <TabsList className="flex flex-wrap h-auto">
                    {SUPPORTED_LOCALES.map((lang) => (
                      <TabsTrigger
                        key={lang}
                        value={lang}
                        className="uppercase"
                      >
                        {lang}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {SUPPORTED_LOCALES.map((lang) => (
                    <TabsContent
                      key={lang}
                      value={lang}
                      className="space-y-4 mt-4"
                    >
                      <FormField
                        control={form.control}
                        name={`locales.${lang}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("products.form.fields.name", {
                                lang: lang.toUpperCase(),
                              })}
                            </FormLabel>
                            <FormControl>
                              <Input
                                disabled={loading || aiTranslating}
                                placeholder={t("attributes.form.fields.name_placeholder", { lang: lang.toUpperCase() })}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>
          </div>
          <Button disabled={loading || aiTranslating} type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            {initialData ? t("common.actions.save") : t("common.actions.create")}
          </Button>
        </form>
      </Form>

      {initialData && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-medium">
              {t("attributes.form.options.title")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("attributes.form.options.description")}
            </p>

            <div className="flex gap-4 items-end">
              <div className="grid gap-2">
                <span className="text-sm font-medium">
                  {t("attributes.form.options.value")}
                </span>
                <Input
                  placeholder={t("attributes.form.options.value_placeholder")}
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  className="w-[200px]"
                />
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium">
                  {t("attributes.form.options.color_optional")}
                </span>
                <div className="flex gap-2">
                  <Input
                    placeholder="#RRGGBB"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="w-[100px]"
                  />
                  <div className="relative w-10 h-10 overflow-hidden rounded border cursor-pointer">
                    <input
                      type="color"
                      value={newColor || "#000000"}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] p-0 m-0 border-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
              <Button onClick={handleAddOption} variant="secondary">
                <Plus className="mr-2 h-4 w-4" />{" "}
                {t("attributes.form.options.add_option")}
              </Button>
            </div>

            <div className="rounded-md border bg-card">
              <div className="p-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {initialData.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="flex items-center gap-2">
                      {option.color && (
                        <div
                          className="h-4 w-4 rounded-full border shadow-sm"
                          style={{ backgroundColor: option.color }}
                        />
                      )}
                      <span className="text-sm font-medium">
                        {option.value}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteOption(option.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {initialData.options.length === 0 && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-4">
                    {t("attributes.form.options.no_options")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
