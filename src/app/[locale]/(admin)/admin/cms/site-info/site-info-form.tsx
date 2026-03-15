"use client";

import { useState, useMemo } from "react";
import { useRouter } from "@/i18n/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { updateGlobalConfig, SiteSettingsData } from "@/lib/actions/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LogoUpload } from "@/components/admin/logo-upload";

const createFormSchema = (t: (key: string) => string) =>
  z.object({
    siteName: z.string().min(1, t("validation.site_name_required")),
    logoUrl: z.string().optional(),
    contactEmail: z.string().email(t("validation.email_invalid")),
    phoneNumber: z.string().min(1, t("validation.phone_required")),
    whatsapp: z.string().optional(),
    address: z.string().min(1, t("validation.address_required")),
    catalogUrl: z.string().optional(),
    sellerTaxId: z.string().optional(),
    currency: z.string().min(1, t("validation.currency_required")),
    // Social links as individual fields
    socialFacebook: z.string().optional(),
    socialInstagram: z.string().optional(),
    socialLinkedin: z.string().optional(),
    socialTwitter: z.string().optional(),
    socialYoutube: z.string().optional(),
    // Footer columns as dynamic array
    footerColumns: z.array(
      z.object({
        title: z.string().min(1),
        links: z.array(
          z.object({
            label: z.string().min(1),
            href: z.string().min(1),
          })
        ),
      })
    ),
  });

type FormValues = z.infer<ReturnType<typeof createFormSchema>>;

export function SiteInfoForm({
  initialData,
}: {
  initialData: SiteSettingsData;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const t = useTranslations("admin.cms.siteInfo");
  const tCommon = useTranslations("admin.common");
  const formSchema = useMemo(() => createFormSchema(t), [t]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      siteName: initialData.siteName,
      logoUrl: initialData.logoUrl || "",
      contactEmail: initialData.contactEmail,
      phoneNumber: initialData.phoneNumber,
      whatsapp: initialData.whatsapp || "",
      address: initialData.address,
      catalogUrl: initialData.catalogUrl || "",
      sellerTaxId: initialData.sellerTaxId || "",
      currency: initialData.currency || "EUR",
      socialFacebook: initialData.socialLinks?.facebook || "",
      socialInstagram: initialData.socialLinks?.instagram || "",
      socialLinkedin: initialData.socialLinks?.linkedin || "",
      socialTwitter: initialData.socialLinks?.twitter || "",
      socialYoutube: initialData.socialLinks?.youtube || "",
      footerColumns: initialData.footerColumns || [],
    },
  });

  const {
    fields: columnFields,
    append: appendColumn,
    remove: removeColumn,
  } = useFieldArray({
    control: form.control,
    name: "footerColumns",
  });

  async function onSubmit(values: FormValues) {
    setLoading(true);
    try {
      const configData: SiteSettingsData = {
        siteName: values.siteName,
        logoUrl: values.logoUrl || undefined,
        contactEmail: values.contactEmail,
        phoneNumber: values.phoneNumber,
        whatsapp: values.whatsapp,
        address: values.address,
        catalogUrl: values.catalogUrl,
        sellerTaxId: values.sellerTaxId,
        currency: values.currency,
        socialLinks: {
          facebook: values.socialFacebook || undefined,
          instagram: values.socialInstagram || undefined,
          linkedin: values.socialLinkedin || undefined,
          twitter: values.socialTwitter || undefined,
          youtube: values.socialYoutube || undefined,
        },
        footerColumns:
          values.footerColumns.length > 0 ? values.footerColumns : undefined,
      };

      await updateGlobalConfig("site_settings", configData);
      toast.success(t("save_success"));
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error(t("save_error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Card 1: Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>{t("general_title")}</CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="siteName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.site_name")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("placeholders.site_name")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <LogoUpload
                      value={field.value || ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.contact_email")}</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.phone_number")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("placeholders.phone")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.whatsapp")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t("placeholders.whatsapp")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellerTaxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.seller_tax_id")}</FormLabel>
                    <FormControl>
                      <Input placeholder="A00000001" {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("fields.seller_tax_id_desc")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("fields.address")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("placeholders.address")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="catalogUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.catalog_url")}</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("fields.catalog_url_desc")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("fields.currency")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="EUR"
                        {...field}
                        className="uppercase w-32"
                      />
                    </FormControl>
                    <FormDescription>
                      {t("fields.currency_desc")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Social Media Links */}
        <Card>
          <CardHeader>
            <CardTitle>{t("social_title")}</CardTitle>
            <CardDescription>{t("social_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="socialFacebook"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("social.facebook")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://facebook.com/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialInstagram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("social.instagram")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://instagram.com/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialLinkedin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("social.linkedin")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://linkedin.com/company/..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialTwitter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("social.twitter")}</FormLabel>
                    <FormControl>
                      <Input placeholder="https://x.com/..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="socialYoutube"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("social.youtube")}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://youtube.com/@..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Footer Column Management */}
        <Card>
          <CardHeader>
            <CardTitle>{t("footer_title")}</CardTitle>
            <CardDescription>{t("footer_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {columnFields.map((column, colIndex) => (
              <div
                key={column.id}
                className="border rounded-lg p-4 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name={`footerColumns.${colIndex}.title`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormLabel>{t("footer.column_title")}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t("footer.column_title")}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="mt-8"
                    onClick={() => removeColumn(colIndex)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <FooterLinksEditor
                  control={form.control}
                  colIndex={colIndex}
                  t={t}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() => appendColumn({ title: "", links: [] })}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("footer.add_column")}
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {tCommon("actions.save")}
        </Button>
      </form>
    </Form>
  );
}

function FooterLinksEditor({
  control,
  colIndex,
  t,
}: {
  control: any;
  colIndex: number;
  t: (key: string) => string;
}) {
  const {
    fields: linkFields,
    append: appendLink,
    remove: removeLink,
  } = useFieldArray({
    control,
    name: `footerColumns.${colIndex}.links`,
  });

  return (
    <div className="pl-4 space-y-3">
      {linkFields.map((link, linkIndex) => (
        <div key={link.id} className="flex items-end gap-2">
          <FormField
            control={control}
            name={`footerColumns.${colIndex}.links.${linkIndex}.label`}
            render={({ field }) => (
              <FormItem className="flex-1">
                {linkIndex === 0 && (
                  <FormLabel>{t("footer.link_label")}</FormLabel>
                )}
                <FormControl>
                  <Input placeholder={t("footer.link_label")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`footerColumns.${colIndex}.links.${linkIndex}.href`}
            render={({ field }) => (
              <FormItem className="flex-1">
                {linkIndex === 0 && (
                  <FormLabel>{t("footer.link_url")}</FormLabel>
                )}
                <FormControl>
                  <Input placeholder="/page-url" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeLink(linkIndex)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => appendLink({ label: "", href: "" })}
      >
        <Plus className="h-4 w-4 mr-1" />
        {t("footer.add_link")}
      </Button>
    </div>
  );
}
