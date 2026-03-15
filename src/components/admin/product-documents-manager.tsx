"use client";

import { useFieldArray, useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, FileText, GripVertical } from "lucide-react";
import { FileUpload } from "@/components/admin/file-upload";
import { SingleImageUpload } from "@/components/admin/single-image-upload";
import { useTranslations } from "next-intl";

const DOCUMENT_TYPES = [
  "CERTIFICATE",
  "DATASHEET",
  "MANUAL",
  "PHOTOMETRIC",
  "OTHER",
] as const;

export function ProductDocumentsManager() {
  const t = useTranslations("admin.products.form.documents");
  const { control, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "documents",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">{t("title")}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            append({
              type: "CERTIFICATE",
              name: "",
              url: "",
              description: "",
              sortOrder: fields.length,
            })
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("add_document")}
        </Button>
      </div>

      {fields.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
          <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("no_documents")}
          </p>
        </div>
      )}

      <div className="space-y-4">
        {fields.map((field, index) => {
          const docType = watch(`documents.${index}.type`);
          return (
            <Card key={field.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="pt-2 text-muted-foreground/40">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={control}
                      name={`documents.${index}.type`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("select_type")}</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("select_type")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DOCUMENT_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {t(`types.${type.toLowerCase()}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`documents.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("name_placeholder")}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder={t("name_placeholder")}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={control}
                      name={`documents.${index}.url`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>File</FormLabel>
                          <FormControl>
                            <FileUpload
                              value={field.value}
                              onChange={field.onChange}
                              uploadPath="product-documents"
                              accept=".pdf,.doc,.docx,.xls,.xlsx,.ies,.ldt,.dwg,.step"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {docType === "CERTIFICATE" && (
                      <FormField
                        control={control}
                        name={`documents.${index}.imageUrl`}
                        render={({ field }) => (
                          <FormItem className="md:col-span-2">
                            <FormLabel>{t("certificate_image")}</FormLabel>
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
                    )}

                    <FormField
                      control={control}
                      name={`documents.${index}.description`}
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>{t("description_placeholder")}</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder={t("description_placeholder")}
                              rows={2}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive mt-6"
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
