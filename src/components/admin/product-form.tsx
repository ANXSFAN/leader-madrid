"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import {
  Category,
  Supplier,
  Product,
  ProductVariant,
  AttributeDefinition,
  AttributeOption,
  BundleItem,
  ProductSupplier,
  ProductDocument,
} from "@prisma/client";
import { Wand2, Loader2, ChevronsUpDown, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { RichTextEditor } from "@/components/admin/cms/rich-text-editor";
import { ImageUpload } from "@/components/admin/image-upload";
import { SpecsConfigurator } from "@/components/admin/specs-configurator";
import { BundleItemsManager } from "@/components/admin/bundle-items-manager";
import { ProductSuppliersManager } from "@/components/admin/product-suppliers-manager";
import { ProductDocumentsManager } from "@/components/admin/product-documents-manager";
import { CategoryTreeSelector } from "@/components/admin/category-tree-selector";
import { ProductVariantsTable } from "@/components/admin/ProductVariantsTable";
import { ProductPriceHistory } from "@/components/admin/product-price-history";
import { createProduct, updateProduct } from "@/lib/actions/product";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  productFormSchema,
  SUPPORTED_LOCALES,
  AI_SUPPORTED_LOCALES,
  AI_FIELDS,
  type ProductFormValues,
  type LocalizedField,
} from "./product-form-schema";

/** Shape of the Product.content JSON field */
interface ProductContentJson {
  images?: string[];
  specs?: Record<string, string>;
  [locale: string]: { name?: string; description?: string; seoTitle?: string; seoDescription?: string } | string[] | Record<string, string> | undefined;
}

/** Shape of the Category.content JSON field */
interface CategoryContentJson {
  [locale: string]: { name?: string } | string | undefined;
}

/** Shape of the AttributeDefinition.name JSON field */
type AttrNameJson = Record<string, string>;

/** Shape of the ProductVariant.specs JSON field */
type VariantSpecsJson = Record<string, string>;

interface ProductFormProps {
  categories: Category[];
  suppliers: Supplier[];
  initialData?: Product & {
    variants: ProductVariant[];
    bundleItems?: (BundleItem & { child: ProductVariant & { product: Product } })[];
    productSuppliers?: ProductSupplier[];
    documents?: ProductDocument[];
  };
  attributeDefinitions: (AttributeDefinition & { options: AttributeOption[] })[];
}

function deriveSpecsFromVariants(
  variants: ProductVariant[],
  existingSpecs: Record<string, string | string[]>
) {
  if (!variants || variants.length <= 1) return existingSpecs;

  const variantSpecsMap: Record<string, Set<string>> = {};

  variants.forEach((v) => {
    const vSpecs = (v.specs as VariantSpecsJson) || {};
    Object.entries(vSpecs).forEach(([key, val]) => {
      if (!variantSpecsMap[key]) variantSpecsMap[key] = new Set();
      variantSpecsMap[key].add(val);
    });
  });

  const mergedSpecs = { ...existingSpecs };

  Object.entries(variantSpecsMap).forEach(([key, valueSet]) => {
    if (valueSet.size > 1) {
      mergedSpecs[key] = Array.from(valueSet);
    }
  });

  return mergedSpecs;
}

export function ProductForm({
  categories,
  suppliers,
  initialData,
  attributeDefinitions,
}: ProductFormProps) {
  const router = useRouter();
  const locale = useLocale(); // 获取当前语言环境
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(false);
  const [activeLangTab, setActiveLangTab] = useState("es");
  const [aiTranslating, setAiTranslating] = useState(false);
  const [aiGeneratingSeo, setAiGeneratingSeo] = useState<string | null>(null);
  const [aiGeneratingDesc, setAiGeneratingDesc] = useState<string | null>(null);

  // Batch update state
  const [selectedVariants, setSelectedVariants] = useState<number[]>([]);
  const [batchPrice, setBatchPrice] = useState("");
  const [batchStock, setBatchStock] = useState("");
  const [batchCostPrice, setBatchCostPrice] = useState("");
  const [batchMinStock, setBatchMinStock] = useState("");
  const [batchEan, setBatchEan] = useState("");

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData
      ? {
          slug: initialData.slug,
          baseSku: initialData.sku,
          type: (initialData.type as "SIMPLE" | "BUNDLE") || "SIMPLE",
          categoryId: initialData.categoryId || "",
          supplierId: initialData.supplierId || "",
          isActive: initialData.isActive,
          isFeatured: initialData.isFeatured,
          images: (initialData.content as ProductContentJson)?.images || [],

          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            const content = initialData.content as ProductContentJson;
            const localeContent = content?.[locale] as { name?: string; description?: string; seoTitle?: string; seoDescription?: string } | undefined;
            acc[locale] = {
              name: localeContent?.name || "",
              description: localeContent?.description || "",
              seoTitle: localeContent?.seoTitle || "",
              seoDescription: localeContent?.seoDescription || "",
            };
            return acc;
          }, {} as Record<string, { name: string; description: string; seoTitle: string; seoDescription: string }>),

          brand: initialData.brand || "",
          series: (initialData.content as ProductContentJson)?.specs?.series || "",
          origin: (initialData.content as ProductContentJson)?.specs?.origin || "",
          hsCode: initialData.hsCode || "",

          // Load specs as direct object
          specs: deriveSpecsFromVariants(
            initialData.variants,
            (initialData.content as ProductContentJson)?.specs || {}
          ),

          hasVariants: initialData.variants.length > 1,
          variants: initialData.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            ean: v.ean || "",
            price: Number(v.price),
            b2bPrice: v.b2bPrice ? Number(v.b2bPrice) : undefined,
            compareAtPrice: v.compareAtPrice
              ? Number(v.compareAtPrice)
              : undefined,
            costPrice: v.costPrice ? Number(v.costPrice) : undefined,
            physicalStock: v.physicalStock,
            allocatedStock: v.allocatedStock,
            minStock: v.minStock,
            specs: (v.specs as VariantSpecsJson) || {},
          })),
          bundleItems:
            initialData.bundleItems?.map((b) => ({
              childId: b.childId,
              quantity: b.quantity,
              sku: b.child?.sku,
              productName: b.child?.product?.slug,
            })) || [],
          productSuppliers:
            initialData.productSuppliers?.map((ps) => ({
              supplierId: ps.supplierId,
              supplierSku: ps.supplierSku || "",
              costPrice: ps.costPrice ? Number(ps.costPrice) : undefined,
              moq: ps.moq || 1,
              isPrimary: ps.isPrimary,
            })) || [],
          documents:
            initialData.documents?.map((doc) => ({
              id: doc.id,
              type: doc.type,
              name: doc.name,
              url: doc.url,
              imageUrl: doc.imageUrl || "",
              description: doc.description || "",
              sortOrder: doc.sortOrder || 0,
            })) || [],
        }
      : {
          slug: "",
          baseSku: "",
          type: "SIMPLE",
          categoryId: "",
          isActive: true,
          isFeatured: false,
          images: [],
          locales: SUPPORTED_LOCALES.reduce((acc, locale) => {
            acc[locale] = {
              name: "",
              description: "",
              seoTitle: "",
              seoDescription: "",
            };
            return acc;
          }, {} as Record<string, { name: string; description: string; seoTitle: string; seoDescription: string }>),
          brand: "",
          series: "",
          origin: "",
          hsCode: "",
          specs: {},
          hasVariants: false,
          variants: [
            {
              sku: "",
              price: 0,
              physicalStock: 0,
              allocatedStock: 0,
              minStock: 0,
              specs: {},
            },
          ],
          documents: [],
        },
  });

  const isBlank = (value?: string | null) =>
    !value || value.toString().trim().length === 0 || value.toString().trim() === "<p></p>";

  const getLocaleFieldValue = (locale: string, field: LocalizedField) => {
    const value = form.getValues(`locales.${locale}.${field}` as const);
    return typeof value === "string" ? value : "";
  };

  const hasLocaleContent = (locale: string) =>
    AI_FIELDS.some((field) => !isBlank(getLocaleFieldValue(locale, field)));

  const translateField = async (field: LocalizedField, sourceLang: string) => {
    const sourceValue = getLocaleFieldValue(sourceLang, field);
    if (isBlank(sourceValue)) return;

    const response = await fetch("/api/ai/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceLang,
        sourceText: sourceValue,
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

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === sourceLang) continue;
      const translated = translations[locale];
      if (isBlank(translated)) continue;
      form.setValue(`locales.${locale}.${field}` as const, translated, {
        shouldDirty: true,
      });
    }
  };

  const runAiGenerateSeo = async (lang: string) => {
    const name = form.getValues(`locales.${lang}.name` as const);
    if (!name?.trim()) {
      toast.error(t("products.form.buttons.seo_generate_no_name"));
      return;
    }

    setAiGeneratingSeo(lang);
    try {
      const response = await fetch("/api/ai/seo-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description:
            form.getValues(`locales.${lang}.description` as const) || "",
          sku: form.getValues("baseSku") || "",
          brand: form.getValues("brand") || "",
          locale: lang,
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "SEO generation failed");
      }

      const data = (await response.json()) as {
        seoTitle: string;
        seoDescription: string;
      };
      form.setValue(`locales.${lang}.seoTitle` as const, data.seoTitle, {
        shouldDirty: true,
      });
      form.setValue(
        `locales.${lang}.seoDescription` as const,
        data.seoDescription,
        { shouldDirty: true }
      );
      toast.success(t("products.form.buttons.seo_generate_success"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("common.messages.something_went_wrong");
      toast.error(message);
    } finally {
      setAiGeneratingSeo(null);
    }
  };

  const runAiGenerateDescription = async (lang: string) => {
    const name = form.getValues(`locales.${lang}.name` as const);
    if (!name?.trim()) {
      toast.error(t("products.form.buttons.desc_generate_no_name"));
      return;
    }

    setAiGeneratingDesc(lang);
    try {
      // Collect specs with localized labels
      const rawSpecs = form.getValues("specs") || {};
      const specsPayload: Record<string, { label: string; value: string; unit?: string }[]> = {};
      for (const [key, value] of Object.entries(rawSpecs)) {
        if (value === undefined || value === null || value === "") continue;
        const attrDef = attributeDefinitions.find((a) => a.key === key);
        const attrName = attrDef?.name as AttrNameJson | undefined;
        const label = attrDef
          ? attrName?.[lang] || attrName?.en || key
          : key;
        const unit = attrDef?.unit || "";
        const values = Array.isArray(value) ? value : [value];
        specsPayload[key] = values.map((v: string) => ({
          label,
          value: String(v),
          ...(unit ? { unit } : {}),
        }));
      }

      // Resolve category name
      let categoryName = "";
      const categoryId = form.getValues("categoryId");
      if (categoryId) {
        const cat = categories.find((c) => c.id === categoryId);
        if (cat) {
          const catContent = cat.content as CategoryContentJson;
          const catLangContent = catContent?.[lang] as { name?: string } | undefined;
          const catEnContent = catContent?.en as { name?: string } | undefined;
          categoryName = catLangContent?.name || catEnContent?.name || cat.slug || "";
        }
      }

      // Collect documents
      const docs = form.getValues("documents") || [];
      const docsPayload = docs.map((d) => ({ type: d.type || "", name: d.name || "" }));

      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: lang,
          productName: name,
          sku: form.getValues("baseSku") || "",
          brand: form.getValues("brand") || "",
          categoryName,
          specs: specsPayload,
          documents: docsPayload.length > 0 ? docsPayload : undefined,
        }),
      });

      if (!response.ok) {
        const err = (await response.json()) as { error?: string };
        throw new Error(err.error || "Description generation failed");
      }

      const data = (await response.json()) as { description: string };
      form.setValue(`locales.${lang}.description` as const, data.description, {
        shouldDirty: true,
      });
      toast.success(t("products.form.buttons.desc_generate_success"));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t("common.messages.something_went_wrong");
      toast.error(message);
    } finally {
      setAiGeneratingDesc(null);
    }
  };

  const runAiTranslate = async (sourceLang: string) => {
    if (!hasLocaleContent(sourceLang)) {
      toast.error(t("products.form.buttons.ai_translate_no_source"));
      return;
    }
    setAiTranslating(true);
    try {
      for (const field of AI_FIELDS) {
        await translateField(field, sourceLang);
      }
      toast.success(t("products.form.buttons.ai_success"));
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

  const {
    fields: variantFields,
    append: appendVariant,
    remove: removeVariant,
    replace: replaceVariant,
  } = useFieldArray({
    control: form.control,
    name: "variants",
  });

  const productType = form.watch("type");
  const specs = form.watch("specs") || {};
  const baseSku = form.watch("baseSku");
  const hasVariants = form.watch("hasVariants");

  // --- Logic: Product State Determination ---

  const multiValueAttributes = Object.entries(specs).filter(
    ([_, value]) => Array.isArray(value) && value.length > 1
  );

  const isBundle = productType === "BUNDLE";
  const isVariable =
    !isBundle && (multiValueAttributes.length > 0 || hasVariants);
  const isSimple = !isBundle && !isVariable;

  // --- Logic: Auto-Generate Variants ---
  useEffect(() => {
    // Only auto-generate if we are in Variable mode
    // We should be careful not to overwrite existing user edits unless specs change
    // But since specs drive variants in this mode, we need to sync.
    // Strategy: Generate SKU/Specs combinations. Match with existing by SKU or Specs.

    if (isVariable) {
      const activeKeys = multiValueAttributes.map(([key]) => key).sort();

      // If no multi-value attributes are defined, do not auto-generate variants.
      // This preserves existing "manual" variants (e.g. imported data) from being wiped out.
      if (activeKeys.length === 0) {
        return;
      }

      const arraysToCombine = activeKeys.map((key) => specs[key] as string[]);

      // Cartesian Product Helper
      const cartesian = (a: string[][]) =>
        a.reduce<string[][]>(
          (a, b) => a.flatMap((d: string[]) => b.map((e: string) => [...d, e])),
          [[]]
        );

      let combinations: string[][] = [];
      if (arraysToCombine.length === 1) {
        combinations = arraysToCombine[0].map((v) => [v]);
      } else if (arraysToCombine.length > 0) {
        combinations = cartesian(arraysToCombine);
      }

      const generatedVariants = combinations.map((combo: string[]) => {
        // Build Specs Object
        const variantSpecs: Record<string, string> = {};
        activeKeys.forEach((key, index) => {
          variantSpecs[key] = combo[index];
        });

        // Generate SKU Suffix
        const suffix = combo.join("-").replace(/\s+/g, "-").toUpperCase();
        const generatedSku = baseSku ? `${baseSku}-${suffix}` : `VAR-${suffix}`;

        return {
          sku: generatedSku,
          specs: variantSpecs,
        };
      });

      // Merge with existing variants
      const currentVariants = form.getValues("variants");
      // Map existing by SKU
      const existingMap = new Map(currentVariants.map((v) => [v.sku, v]));

      // Also map by Specs to handle Base SKU changes (where SKU changes but variant identity is same)
      const getSpecKey = (s: Record<string, string> | undefined) =>
        JSON.stringify(Object.entries(s || {}).sort());
      const existingBySpecs = new Map();
      currentVariants.forEach((v) => {
        existingBySpecs.set(getSpecKey(v.specs), v);
      });

      const newVariants = generatedVariants.map((gen) => {
        // 1. Try match by SKU
        let existing = existingMap.get(gen.sku);

        // 2. If not found, try match by Specs
        if (!existing) {
          existing = existingBySpecs.get(getSpecKey(gen.specs));
        }

        if (existing) {
          // Preserve price, stock, id, etc.
          return {
            ...existing,
            sku: gen.sku, // Update SKU to match new pattern
            specs: gen.specs, // Ensure specs match exactly
          };
        }
        // New variant
        return {
          id: undefined,
          sku: gen.sku,
          price: currentVariants[0]?.price || 0, // Inherit base price
          costPrice: currentVariants[0]?.costPrice,
          physicalStock: 0,
          allocatedStock: 0,
          minStock: 0,
          specs: gen.specs,
        };
      });

      // Avoid infinite loop: only update if deep different
      // Simple check: length or SKU list
      const currentSkus = currentVariants
        .map((v) => v.sku)
        .sort()
        .join(",");
      const newSkus = newVariants
        .map((v) => v.sku)
        .sort()
        .join(",");

      if (
        currentSkus !== newSkus ||
        currentVariants.length !== newVariants.length
      ) {
        // If we have drastic changes, replace.
        // Note: This might be annoying if user is typing baseSku.
        // So we depend on [JSON.stringify(specs), isVariable]
        replaceVariant(newVariants);
      } else {
        // Check specs equality?
      }
    } else if (isSimple) {
      // Ensure we have exactly 1 variant
      if (variantFields.length !== 1) {
        // If we had multiple, keep the first one or reset
        const first = variantFields[0] || {
          sku: baseSku,
          price: 0,
          physicalStock: 0,
          allocatedStock: 0,
          minStock: 0,
          specs: {},
        };
        // Clear variant specs as it is simple
        const simpleVariant = {
          ...first,
          specs: {},
          sku: baseSku || first.sku,
        };
        replaceVariant([simpleVariant]);
      } else {
        // Sync SKU if it differs from baseSku (optional, but good for Simple products)
        const current = variantFields[0];
        if (baseSku && current.sku !== baseSku) {
          form.setValue("variants.0.sku", baseSku);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(specs), productType, baseSku]); // Add baseSku to dep if we want auto-update SKU

  // --- Submit Handler ---

  const onSubmit = async (data: ProductFormValues) => {
    try {
      setLoading(true);

      // Prepare Locales
      const filledLocales = { ...data.locales };
      const esContent = data.locales.es;

      // Auto-fill missing locales logic (same as before)
      (Object.keys(filledLocales) as Array<keyof typeof filledLocales>).forEach(
        (lang) => {
          if (lang === "es") return;
          if (!filledLocales[lang].name)
            filledLocales[lang].name = esContent.name;
          // ... other fields
        }
      );

      // Process Specs:
      // data.specs contains both Strings (Common) and Arrays (Variant Axes)
      // Backend expects 'specs' to be KV map.
      // User said: "Single value -> Common", "Multi value -> Variant"
      // So we filter data.specs to keep only single values (strings) for the product.specs
      // Arrays are already used to generate variants.

      const commonSpecs: Record<string, string> = {};
      Object.entries(data.specs || {}).forEach(([key, value]) => {
        if (typeof value === "string") {
          commonSpecs[key] = value;
        }
        // Arrays are ignored here, they live in variants
      });

      const payload = {
        slug: data.slug,
        baseSku: data.baseSku,
        sku: data.baseSku,
        type: data.type,
        categoryId: data.categoryId,
        supplierId: data.supplierId,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        locales: filledLocales,
        brand: data.brand,
        series: data.series,
        origin: data.origin,
        hsCode: data.hsCode,
        specs: commonSpecs, // Only common specs
        images: data.images,
        variants: data.variants.map((v) => ({
          ...v,
          price: Number(v.price),
          physicalStock: Number(v.physicalStock),
          allocatedStock: Number(v.allocatedStock),
          minStock: Number(v.minStock),
        })),
        bundleItems: data.type === "BUNDLE" ? data.bundleItems : undefined,
        productSuppliers: data.productSuppliers,
        documents: data.documents,
      };

      let result;
      if (initialData) {
        result = await updateProduct(initialData.id, payload);
      } else {
        result = await createProduct(payload);
      }

      if (result?.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        initialData
          ? t("products.form.toast.updated")
          : t("products.form.toast.created")
      );
      if (!initialData) router.push("/admin/products");
      router.refresh();
    } catch (error: unknown) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t("common.messages.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  // --- Batch Operations (same as before) ---
  const toggleSelectAll = () => {
    if (selectedVariants.length === variantFields.length) {
      setSelectedVariants([]);
    } else {
      setSelectedVariants(variantFields.map((_, i) => i));
    }
  };
  const toggleSelectVariant = (index: number) => {
    setSelectedVariants((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };
  const applyBatchUpdate = () => {
    // ... reuse existing logic or simplify
    const price = parseFloat(batchPrice);
    const stock = parseInt(batchStock);
    // etc.
    const currentVariants = form.getValues("variants");
    const newVariants = [...currentVariants];
    selectedVariants.forEach((index) => {
      if (newVariants[index]) {
        if (!isNaN(price)) newVariants[index].price = price;
        if (!isNaN(stock)) newVariants[index].physicalStock = stock;
        // ...
      }
    });
    replaceVariant(newVariants);
    toast.success(t("common.messages.save_success"));
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form validation errors:", errors);
          toast.error(t("common.messages.fill_required_fields"));
        })}
        className="space-y-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {initialData
                ? t("products.form.title_edit")
                : t("products.form.title_create")}
            </h2>
            <p className="text-muted-foreground">
              {isSimple
                ? t("products.form.types.simple")
                : isBundle
                  ? t("products.form.types.bundle")
                  : t("products.form.types.variable")}
            </p>
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black"
          >
            {loading
              ? t("products.form.buttons.saving")
              : t("products.form.buttons.save_product")}
          </Button>
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className={`grid w-full ${initialData ? "grid-cols-5" : "grid-cols-4"}`}>
            <TabsTrigger value="details">
              {t("products.form.tabs.details")}
            </TabsTrigger>
            <TabsTrigger value="organization">
              {t("products.form.tabs.organization")}
            </TabsTrigger>
            <TabsTrigger value="variants">
              {t("products.form.tabs.variants")}
            </TabsTrigger>
            <TabsTrigger value="documents">
              {t("products.form.tabs.documents")}
            </TabsTrigger>
            {initialData && (
              <TabsTrigger value="price-history">
                {t("products.form.tabs.priceHistory")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="details" className="space-y-4 pt-4">
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.tabs.details")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("products.form.fields.slug")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="baseSku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("products.form.fields.base_sku")}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <div className="flex items-center justify-between border p-4 rounded-lg">
                        <Label>{t("products.form.fields.active_status")}</Label>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isFeatured"
                    render={({ field }) => (
                      <div className="flex items-center justify-between border p-4 rounded-lg">
                        <Label>{t("products.form.fields.featured_status")}</Label>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </div>
                    )}
                  />
                </div>

                <Tabs
                  value={activeLangTab}
                  onValueChange={setActiveLangTab}
                  className="w-full pt-4"
                >
                  <div className="flex justify-end pb-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void runAiTranslate(activeLangTab)}
                      disabled={aiTranslating}
                    >
                      {aiTranslating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          {t("products.form.buttons.ai_translating")}
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-2" />
                          {t("products.form.buttons.ai_translate")}
                        </>
                      )}
                    </Button>
                  </div>
                  <TabsList className="flex flex-wrap h-auto">
                    {SUPPORTED_LOCALES.map((lang) => (
                      <TabsTrigger
                        key={lang}
                        value={lang}
                        className="text-xs uppercase"
                      >
                        {lang}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {SUPPORTED_LOCALES.map((lang) => (
                    <TabsContent
                      key={lang}
                      value={lang}
                      className="space-y-3 mt-4"
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
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`locales.${lang}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>
                                {t("products.form.fields.description", {
                                  lang: lang.toUpperCase(),
                                })}
                              </FormLabel>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                disabled={aiGeneratingDesc === lang}
                                onClick={() => runAiGenerateDescription(lang)}
                              >
                                {aiGeneratingDesc === lang ? (
                                  <>
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {t("products.form.buttons.desc_generating")}
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="h-3 w-3" />
                                    {t("products.form.buttons.desc_generate")}
                                  </>
                                )}
                              </Button>
                            </div>
                            <FormControl>
                              <RichTextEditor
                                value={field.value || ""}
                                onChange={field.onChange}
                                placeholder={t("products.form.fields.description", {
                                  lang: lang.toUpperCase(),
                                })}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      {/* SEO section header + AI generate button */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          SEO
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          disabled={aiGeneratingSeo === lang}
                          onClick={() => runAiGenerateSeo(lang)}
                        >
                          {aiGeneratingSeo === lang ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              {t("products.form.buttons.seo_generating")}
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-3 w-3" />
                              {t("products.form.buttons.seo_generate")}
                            </>
                          )}
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`locales.${lang}.seoTitle`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("products.form.fields.seo_title", {
                                lang: lang.toUpperCase(),
                              })}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`locales.${lang}.seoDescription`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("products.form.fields.seo_description", {
                                lang: lang.toUpperCase(),
                              })}
                            </FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.extra.media_title")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="images"
                  render={({ field }) => (
                    <ImageUpload
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="organization" className="space-y-4 pt-4">
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.tabs.organization")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("products.form.fields.category")}
                      </FormLabel>
                      <FormControl>
                        <CategoryTreeSelector
                          categories={categories}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("products.form.fields.brand")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="series"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("products.form.fields.series")}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="origin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("products.form.fields.origin")}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hsCode"
                    render={({ field }) => {
                      const HS_PRESETS = [
                        { code: "9405.42", desc: t("products.form.hs_presets.9405_42") },
                        { code: "8539.50", desc: t("products.form.hs_presets.8539_50") },
                        { code: "8541.41", desc: t("products.form.hs_presets.8541_41") },
                        { code: "9405.11", desc: t("products.form.hs_presets.9405_11") },
                        { code: "9405.19", desc: t("products.form.hs_presets.9405_19") },
                        { code: "9405.49", desc: t("products.form.hs_presets.9405_49") },
                        { code: "8504.40", desc: t("products.form.hs_presets.8504_40") },
                        { code: "9405.99", desc: t("products.form.hs_presets.9405_99") },
                      ];
                      const [hsOpen, setHsOpen] = useState(false);
                      return (
                        <FormItem className="flex flex-col">
                          <FormLabel>{t("products.form.fields.hs_code")}</FormLabel>
                          <Popover open={hsOpen} onOpenChange={setHsOpen}>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className={cn("w-full justify-between font-mono", !field.value && "text-muted-foreground")}
                                >
                                  {field.value || t("products.form.placeholders.hs_code")}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                              <Command>
                                <CommandInput placeholder={t("products.form.placeholders.hs_code_search")} />
                                <CommandList>
                                  <CommandEmpty>{t("products.form.placeholders.hs_code_custom")}</CommandEmpty>
                                  <CommandGroup>
                                    {HS_PRESETS.map((hs) => (
                                      <CommandItem
                                        key={hs.code}
                                        value={`${hs.code} ${hs.desc}`}
                                        onSelect={() => {
                                          field.onChange(hs.code);
                                          setHsOpen(false);
                                        }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", field.value === hs.code ? "opacity-100" : "opacity-0")} />
                                        <span className="font-mono mr-2">{hs.code}</span>
                                        <span className="text-muted-foreground text-xs">{hs.desc}</span>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                              <div className="border-t p-2">
                                <Input
                                  placeholder={t("products.form.placeholders.hs_code_manual")}
                                  className="font-mono"
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setHsOpen(false); } }}
                                />
                              </div>
                            </PopoverContent>
                          </Popover>
                          <FormDescription className="text-xs">
                            {t("products.form.hs_code_hint")}
                          </FormDescription>
                        </FormItem>
                      );
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.tabs.suppliers")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductSuppliersManager
                  name="productSuppliers"
                  suppliers={suppliers}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="variants" className="space-y-4 pt-4">
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.tabs.variants")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem className="mb-6">
                      <FormLabel>
                        {t("products.form.fields.product_type")}
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SIMPLE">
                            {t("products.form.types.simple")}
                          </SelectItem>
                          <SelectItem value="BUNDLE">
                            {t("products.form.types.bundle")}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {t("products.form.extra.type_change_warning")}
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {/* Specs Configurator - Only for Non-Bundle */}
                {!isBundle && (
                  <div className="space-y-4">
                    <div className="border-t pt-4">
                      <h3 className="text-sm font-medium mb-2">
                        {t("products.form.tabs.specs")}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {t("products.form.extra.specs_description")}
                      </p>
                      <SpecsConfigurator
                        definitions={attributeDefinitions}
                        value={specs}
                        onChange={(key, val) => {
                          const newSpecs = { ...specs };
                          if (val === undefined) {
                            delete newSpecs[key];
                          } else {
                            newSpecs[key] = val;
                          }
                          form.setValue("specs", newSpecs);
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dynamic Content based on Type */}
            {isSimple && (
              <Card className="hover:shadow-md transition-all duration-200">
                <CardHeader>
                  <CardTitle className="border-l-4 border-yellow-500 pl-3">
                    {t("products.form.extra.pricing_title")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="variants.0.price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("products.form.fields.price")}</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="variants.0.compareAtPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("products.form.fields.compare_at_price")}
                        </FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="variants.0.costPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t("products.form.fields.cost_price")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            readOnly
                            tabIndex={-1}
                            className="bg-muted cursor-not-allowed"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="variants.0.physicalStock"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("products.form.fields.stock")}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            readOnly={!!initialData}
                            tabIndex={initialData ? -1 : undefined}
                            className={
                              initialData ? "bg-muted cursor-not-allowed" : ""
                            }
                            {...field}
                          />
                        </FormControl>
                        {initialData && (
                          <FormDescription className="text-xs">
                            {t("products.form.extra.stock_managed_via_orders")}
                          </FormDescription>
                        )}
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="variants.0.sku"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("products.form.fields.sku")}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {isVariable && (
              <ProductVariantsTable
                form={form}
                variantFields={variantFields}
                selectedVariants={selectedVariants}
                toggleSelectAll={toggleSelectAll}
                toggleSelectVariant={toggleSelectVariant}
                batchPrice={batchPrice}
                setBatchPrice={setBatchPrice}
                batchStock={batchStock}
                setBatchStock={setBatchStock}
                applyBatchUpdate={applyBatchUpdate}
                isEditing={!!initialData}
              />
            )}

            {isBundle && (
              <>
                <Card className="hover:shadow-md transition-all duration-200">
                  <CardHeader>
                    <CardTitle className="border-l-4 border-yellow-500 pl-3">
                      {t("products.form.extra.bundle_title")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="variants.0.price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("products.form.fields.price")}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="variants.0.compareAtPrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("products.form.fields.compare_at_price")}
                          </FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="variants.0.sku"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("products.form.fields.sku")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-all duration-200">
                  <CardHeader>
                    <CardTitle className="border-l-4 border-yellow-500 pl-3">
                      {t("products.form.tabs.bundle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BundleItemsManager
                      control={form.control}
                      name="bundleItems"
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 pt-4">
            <Card className="hover:shadow-md transition-all duration-200">
              <CardHeader>
                <CardTitle className="border-l-4 border-yellow-500 pl-3">
                  {t("products.form.tabs.documents")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProductDocumentsManager />
              </CardContent>
            </Card>
          </TabsContent>

          {initialData && (
            <TabsContent value="price-history" className="space-y-4 pt-4">
              <ProductPriceHistory
                productId={initialData.id}
                locale={locale}
                currency="EUR"
              />
            </TabsContent>
          )}
        </Tabs>
      </form>
    </Form>
  );
}
