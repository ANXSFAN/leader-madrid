"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createFederationNode } from "@/lib/actions/federation";
import { Copy, Check } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z
    .string()
    .min(2, "Code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/i, "Only letters, numbers, hyphens, and underscores"),
  type: z.enum(["UPSTREAM", "DOWNSTREAM"]),
  baseUrl: z.string().url("Must be a valid URL"),
  defaultCurrency: z.string().default("EUR"),
  paymentTermsDays: z.coerce.number().int().min(0).default(30),
  creditLimit: z.coerce.number().min(0).optional(),
  supplierId: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface SupplierOption {
  id: string;
  name: string;
  code: string;
}

interface FederationNodeFormProps {
  suppliers: SupplierOption[];
}

export function FederationNodeForm({ suppliers }: FederationNodeFormProps) {
  const t = useTranslations("admin.federation");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [createdKeys, setCreatedKeys] = useState<{
    apiKey: string;
    apiSecret: string;
    inboundKey: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "DOWNSTREAM",
      baseUrl: "",
      defaultCurrency: "EUR",
      paymentTermsDays: 30,
      supplierId: undefined,
    },
  });

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      try {
        const result = await createFederationNode({
          ...values,
          supplierId:
            values.supplierId === "__none__" ? undefined : values.supplierId,
        });
        setCreatedKeys({
          apiKey: result.apiKey,
          apiSecret: result.apiSecret,
          inboundKey: result.inboundKey,
        });
        toast.success(t("messages.created"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("messages.error")
        );
      }
    });
  }

  async function copyToClipboard(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  if (createdKeys) {
    const keyFields = [
      { key: "apiKey" as const, label: t("form.api_key") },
      { key: "apiSecret" as const, label: t("form.api_secret") },
      { key: "inboundKey" as const, label: t("form.inbound_key") },
    ];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="border-l-4 border-accent pl-3">
            {t("keys_generated")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("keys_warning")}</p>

          {keyFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                {label}
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-slate-100 px-3 py-2 rounded text-sm font-mono break-all">
                  {createdKeys[key]}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(createdKeys[key], key)}
                >
                  {copiedField === key ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}

          <div className="pt-4">
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
              onClick={() => router.push("/admin/federation")}
            >
              {t("back_to_list")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="border-l-4 border-accent pl-3">
              {t("form.basic_info")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.name")}</Label>
              <Input
                id="name"
                placeholder={t("form.name_placeholder")}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">{t("form.code")}</Label>
              <Input
                id="code"
                placeholder={t("form.code_placeholder")}
                {...form.register("code")}
              />
              {form.formState.errors.code && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.code.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>{t("form.type")}</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(v) =>
                  form.setValue("type", v as "UPSTREAM" | "DOWNSTREAM")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPSTREAM">
                    {t("type.upstream")}
                  </SelectItem>
                  <SelectItem value="DOWNSTREAM">
                    {t("type.downstream")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseUrl">{t("form.base_url")}</Label>
              <Input
                id="baseUrl"
                placeholder="https://partner-erp.example.com"
                {...form.register("baseUrl")}
              />
              {form.formState.errors.baseUrl && (
                <p className="text-xs text-red-500">
                  {form.formState.errors.baseUrl.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Business Terms */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="border-l-4 border-accent pl-3">
              {t("form.business_terms")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t("form.default_currency")}</Label>
              <Select
                value={form.watch("defaultCurrency")}
                onValueChange={(v) => form.setValue("defaultCurrency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["EUR","GBP","USD","PLN","SEK","DKK","CZK","CHF","NOK"].map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentTermsDays">
                {t("form.payment_terms")}
              </Label>
              <Input
                id="paymentTermsDays"
                type="number"
                min={0}
                {...form.register("paymentTermsDays")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="creditLimit">{t("form.credit_limit")}</Label>
              <Input
                id="creditLimit"
                type="number"
                min={0}
                step="0.01"
                placeholder={t("form.credit_limit_placeholder")}
                {...form.register("creditLimit")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("form.linked_supplier")}</Label>
              <Select
                value={form.watch("supplierId") || "__none__"}
                onValueChange={(v) =>
                  form.setValue("supplierId", v === "__none__" ? undefined : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("form.no_supplier")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("form.no_supplier")}
                  </SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end mt-6">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-black"
        >
          {isPending ? t("form.creating") : t("form.create")}
        </Button>
      </div>
    </form>
  );
}
