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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Category } from "@prisma/client";
import { createCategory, updateCategory } from "@/lib/actions/category";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import { useTranslations, useLocale } from "next-intl";
import { Wand2 } from "lucide-react";

/** Shape of the Category.content JSON field */
interface CategoryContentJson {
  imageUrl?: string;
  icon?: string;
  [locale: string]: { name?: string } | string | undefined;
}

const SUPPORTED_LOCALES = ["en", "es", "zh", "fr", "de", "it", "pt", "nl", "pl"] as const;

const AI_SUPPORTED_LOCALES = [
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

const localizedSchema = z.object({
  name: z.string().optional(),
});

const categoryFormSchema = z.object({
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must be lowercase and dash-separated"
    ),
  parentId: z.string().optional(),
  imageUrl: z.string().optional(),
  icon: z.string().optional(),
  locales: z.object(
    SUPPORTED_LOCALES.reduce((acc, locale) => {
      acc[locale] =
        locale === "es"
          ? (localizedSchema.extend({
              name: z.string().min(1, "Name (ES) is required"),
            }) as unknown as typeof localizedSchema)
          : localizedSchema;
      return acc;
    }, {} as Record<string, typeof localizedSchema>)
  ),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  initialData?: Category | null;
  categories: Category[]; // For parent selection
}

export function CategoryForm({ initialData, categories }: CategoryFormProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const tp = useTranslations("admin.products.form.buttons");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState("en");
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: initialData
      ? {
          slug: initialData.slug,
          parentId: initialData.parentId || undefined,
          imageUrl: (initialData.content as CategoryContentJson)?.imageUrl || "",
          icon: (initialData.content as CategoryContentJson)?.icon || "",
          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            const content = initialData.content as CategoryContentJson;
            const localeContent = content?.[locale] as { name?: string } | undefined;
            acc[locale] = {
              name: localeContent?.name || "",
            };
            return acc;
          }, {} as Record<string, { name: string }>),
        }
      : {
          slug: "",
          imageUrl: "",
          icon: "",
          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            acc[locale] = { name: "" };
            return acc;
          }, {} as Record<string, { name: string }>),
        },
  });

  const onSubmit = async (data: CategoryFormValues) => {
    try {
      setLoading(true);
      const payload = {
        slug: data.slug,
        parentId: data.parentId === "root" ? null : data.parentId,
        content: {
          ...data.locales,
          imageUrl: data.imageUrl,
          icon: data.icon,
        },
      };

      if (initialData) {
        await updateCategory(initialData.id, payload);
        toast.success(t("common.messages.save_success"));
      } else {
        await createCategory(payload);
        toast.success(t("common.messages.save_success"));
        router.push("/admin/categories");
      }
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("common.messages.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  // --- AI Translation logic ---

  const isBlank = (v: unknown): v is undefined | null | "" =>
    v === undefined || v === null || v === "";

  const getLocaleNameValue = (loc: string): string =>
    (form.getValues(`locales.${loc}.name` as `locales.${string}.name`) as string) ?? "";

  const hasLocaleContent = (loc: string) => !isBlank(getLocaleNameValue(loc));

  const buildContentPayload = (sourceLang: "zh" | "es") => {
    const payload: Record<string, string> = {};
    for (const loc of AI_SUPPORTED_LOCALES) {
      const value = (SUPPORTED_LOCALES as readonly string[]).includes(loc)
        ? getLocaleNameValue(loc)
        : "";
      payload[loc] = value;
    }
    if (sourceLang === "es") {
      payload.zh = "";
    }
    return payload;
  };

  const runAiTranslate = async (sourceLang: "zh" | "es") => {
    const sourceValue = getLocaleNameValue(sourceLang);
    if (isBlank(sourceValue)) return;

    setAiTranslating(true);
    try {
      const response = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: buildContentPayload(sourceLang),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "AI translate failed");
      }

      const data = (await response.json()) as {
        translations?: Record<string, string>;
      };
      const translations = data.translations || {};

      for (const loc of SUPPORTED_LOCALES) {
        const current = getLocaleNameValue(loc);
        if (!isBlank(current)) continue;
        const translated = translations[loc];
        if (isBlank(translated)) continue;
        form.setValue(`locales.${loc}.name` as `locales.${string}.name`, translated, {
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

  const handleAiClick = () => {
    if (aiTranslating) return;
    const hasZh = hasLocaleContent("zh");
    const hasEs = hasLocaleContent("es");

    if (!hasZh && !hasEs) {
      toast.error(t("common.messages.something_went_wrong"));
      return;
    }

    if (hasZh && hasEs) {
      setAiMenuOpen(true);
      return;
    }

    void runAiTranslate(hasZh ? "zh" : "es");
  };

  // Helper to find all descendants to prevent circular reference
  const getDescendants = (parentId: string, allCats: Category[]): string[] => {
    const children = allCats.filter((c) => c.parentId === parentId);
    let descendants = children.map((c) => c.id);
    children.forEach((child) => {
      descendants = [...descendants, ...getDescendants(child.id, allCats)];
    });
    return descendants;
  };

  const descendants = initialData
    ? getDescendants(initialData.id, categories)
    : [];

  // Filter out self and descendants from parent options
  const parentOptions = categories.filter(
    (c) => c.id !== initialData?.id && !descendants.includes(c.id)
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {initialData ? t("categories.title_edit") : t("categories.title_create")}
            </h2>
          </div>
          <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            {loading ? t("common.actions.loading") : t("common.actions.save")}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">{t("common.status.active")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories.fields.slug")}</FormLabel>
                    <FormControl>
                      <Input placeholder="category-slug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories.fields.parent")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("categories.placeholders.select_parent")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="root">
                          {t("categories.placeholders.none_root")}
                        </SelectItem>
                        {parentOptions.map((cat) => {
                          const c = cat.content as CategoryContentJson;
                          const catLocale = c?.[locale] as { name?: string } | undefined;
                          const catEn = c?.en as { name?: string } | undefined;
                          const catEs = c?.es as { name?: string } | undefined;
                          return (
                            <SelectItem key={cat.id} value={cat.id}>
                              {catLocale?.name || catEn?.name || catEs?.name || cat.slug}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories.fields.image")}</FormLabel>
                    <FormControl>
                      <SingleImageUpload
                        value={field.value || ""}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("categories.fields.icon")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Lightbulb or https://..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">{t("categories.fields.localized_names")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={activeLangTab} onValueChange={setActiveLangTab}>
                <div className="flex justify-end pb-2">
                  <DropdownMenu
                    open={aiMenuOpen}
                    onOpenChange={setAiMenuOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAiClick}
                        disabled={aiTranslating}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {tp("ai_translate")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setAiMenuOpen(false);
                          void runAiTranslate("zh");
                        }}
                      >
                        {tp("translate_from_zh")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setAiMenuOpen(false);
                          void runAiTranslate("es");
                        }}
                      >
                        {tp("translate_from_es")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <TabsList className="flex flex-wrap h-auto">
                  {SUPPORTED_LOCALES.map((lang) => (
                    <TabsTrigger key={lang} value={lang} className="uppercase">
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
                          <FormLabel>{t("products.form.fields.name", { lang: lang.toUpperCase() })}</FormLabel>
                          <FormControl>
                            <Input
                              disabled={loading || aiTranslating}
                              placeholder={`Name in ${lang}`}
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
      </form>
    </Form>
  );
}
