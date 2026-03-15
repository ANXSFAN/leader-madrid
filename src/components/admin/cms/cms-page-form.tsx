"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createCmsPage, updateCmsPage } from "@/lib/actions/cms-pages";
import type { CmsPageType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { toast } from "sonner";
import { ImageUpload } from "@/components/admin/image-upload";
import { RichTextEditor } from "@/components/admin/cms/rich-text-editor";
import { Loader2, ArrowLeft, Wand2 } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/admin/page-header";

const LOCALES = ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "zh"];

interface CmsPageFormProps {
  initialData?: any;
}

export function CmsPageForm({ initialData }: CmsPageFormProps) {
  const t = useTranslations("admin.cms.pages");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [aiTranslating, setAiTranslating] = useState(false);
  const [activeLocale, setActiveLocale] = useState("en");
  const isEditing = !!initialData;

  const [slug, setSlug] = useState("");
  const [type, setType] = useState("SOLUTION");
  const [menuGroup, setMenuGroup] = useState("");
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState("");
  const [content, setContent] = useState<
    Record<string, { title: string; description: string; body: string }>
  >({});

  const PAGE_TYPES = [
    { value: "SOLUTION", label: t("type_solution") },
    { value: "LEGAL", label: t("type_legal") },
    { value: "GENERAL", label: t("type_general") },
  ];

  useEffect(() => {
    if (initialData) {
      setSlug(initialData.slug || "");
      setType(initialData.type || "SOLUTION");
      setMenuGroup(initialData.menuGroup || "");
      setOrder(initialData.order || 0);
      setIsActive(initialData.isActive ?? true);
      setImageUrl(initialData.imageUrl || "");
      setContent(initialData.content || {});
    }
  }, [initialData]);

  const updateLocaleContent = (
    locale: string,
    field: string,
    value: string
  ) => {
    setContent((prev) => ({
      ...prev,
      [locale]: {
        ...{ title: "", description: "", body: "" },
        ...prev[locale],
        [field]: value,
      },
    }));
  };

  const runAiTranslate = async () => {
    const source = content[activeLocale];
    const isBodyEmpty = (b: string) => !b || b === "<p></p>";
    const hasAny =
      source?.title?.trim() ||
      source?.description?.trim() ||
      !isBodyEmpty(source?.body);

    if (!hasAny) {
      toast.error(t("ai_no_source"));
      return;
    }

    setAiTranslating(true);
    try {
      const translateField = async (
        fieldValue: string | undefined
      ): Promise<Record<string, string>> => {
        const isEmpty = !fieldValue?.trim() || fieldValue === "<p></p>";
        if (isEmpty) return {};
        const res = await fetch("/api/ai/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceLang: activeLocale,
            sourceText: fieldValue,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as {
          translations: Record<string, string>;
        };
        return data.translations;
      };

      // Translate all three fields concurrently
      const [titleTr, descTr, bodyTr] = await Promise.all([
        translateField(source?.title),
        translateField(source?.description),
        translateField(source?.body),
      ]);

      setContent((prev) => {
        const updated = { ...prev };
        for (const locale of LOCALES) {
          if (locale === activeLocale) continue;
          const existing = updated[locale] || {
            title: "",
            description: "",
            body: "",
          };
          updated[locale] = {
            title:
              !existing.title?.trim() && titleTr[locale]
                ? titleTr[locale]
                : existing.title,
            description:
              !existing.description?.trim() && descTr[locale]
                ? descTr[locale]
                : existing.description,
            body:
              isBodyEmpty(existing.body) && bodyTr[locale]
                ? bodyTr[locale]
                : existing.body,
          };
        }
        return updated;
      });

      toast.success(t("ai_translate_success"));
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setAiTranslating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) {
      toast.error(t("slug_required"));
      return;
    }
    setLoading(true);

    try {
      const data = {
        slug: slug.trim(),
        type: type as CmsPageType,
        content: content as Prisma.InputJsonValue,
        imageUrl: imageUrl || undefined,
        order,
        isActive,
        menuGroup: menuGroup || undefined,
      };

      let result;
      if (isEditing) {
        result = await updateCmsPage(initialData.id, data as any);
      } else {
        result = await createCmsPage(data as any);
      }

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isEditing ? t("page_updated") : t("page_created"));
        router.push("/admin/cms/pages");
      }
    } catch {
      toast.error(t("something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PageHeader
        title={isEditing ? t("edit_title") : t("create_title")}
        breadcrumbs={[
          { label: "CMS", href: "/admin/cms/banners" },
          { label: t("title"), href: "/admin/cms/pages" },
          { label: isEditing ? t("edit_title") : t("create_title") },
        ]}
      />

      {/* Basic Settings */}
      <Card className="hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("basic_settings")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slug">{t("slug")} *</Label>
              <Input
                id="slug"
                value={slug}
                onChange={(e) =>
                  setSlug(
                    e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
                  )
                }
                placeholder={t("slug_placeholder")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("page_type")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="menuGroup">{t("menu_group")}</Label>
              <Input
                id="menuGroup"
                value={menuGroup}
                onChange={(e) => setMenuGroup(e.target.value)}
                placeholder={t("menu_group_placeholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="order">{t("sort_order")}</Label>
              <Input
                id="order"
                type="number"
                value={order}
                onChange={(e) => setOrder(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="active">{t("active")}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Cover Image */}
      <Card className="hover:shadow-md transition-all duration-200">
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("media_title")}
          </CardTitle>
          <CardDescription>{t("cover_image_description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            value={imageUrl ? [imageUrl] : []}
            onChange={(urls) => setImageUrl(urls.length > 0 ? urls[0] : "")}
          />
        </CardContent>
      </Card>

      {/* Multilingual Content */}
      <Card className="hover:shadow-md transition-all duration-200">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="border-l-4 border-yellow-500 pl-3">
                {t("content_title")}
              </CardTitle>
              <CardDescription className="mt-1.5">
                {t("content_description")}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={runAiTranslate}
              disabled={aiTranslating}
              className="shrink-0 border-yellow-400 text-yellow-700 hover:bg-yellow-50"
            >
              {aiTranslating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              {aiTranslating
                ? t("ai_translating")
                : t("ai_translate_from", {
                    locale: activeLocale.toUpperCase(),
                  })}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeLocale} onValueChange={setActiveLocale}>
            <TabsList className="flex flex-wrap gap-1">
              {LOCALES.map((loc) => (
                <TabsTrigger
                  key={loc}
                  value={loc}
                  className="uppercase text-xs"
                >
                  {loc}
                </TabsTrigger>
              ))}
            </TabsList>
            {LOCALES.map((loc) => (
              <TabsContent key={loc} value={loc} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>
                    {t("field_title", { locale: loc.toUpperCase() })}
                  </Label>
                  <Input
                    value={content[loc]?.title || ""}
                    onChange={(e) =>
                      updateLocaleContent(loc, "title", e.target.value)
                    }
                    placeholder={t("field_title_placeholder", { locale: loc })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t("field_description", { locale: loc.toUpperCase() })}
                  </Label>
                  <Textarea
                    value={content[loc]?.description || ""}
                    onChange={(e) =>
                      updateLocaleContent(loc, "description", e.target.value)
                    }
                    placeholder={t("field_description_placeholder", {
                      locale: loc,
                    })}
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t("field_body", { locale: loc.toUpperCase() })}
                  </Label>
                  <RichTextEditor
                    value={content[loc]?.body || ""}
                    onChange={(val) => updateLocaleContent(loc, "body", val)}
                    placeholder={t("field_body_placeholder", { locale: loc })}
                  />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <Link href="/admin/cms/pages">
          <Button type="button" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" /> {t("back")}
          </Button>
        </Link>
        <Button
          type="submit"
          disabled={loading}
          className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? t("update_page") : t("create_page")}
        </Button>
      </div>
    </form>
  );
}
