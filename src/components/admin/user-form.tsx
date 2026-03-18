"use client";

import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createUser, updateUser } from "@/lib/actions/user";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Role, B2BStatus } from "@prisma/client";

interface UserFormData {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  b2bStatus: B2BStatus;
  customerLevel: string | null;
  priceListId?: string;
  isActive: boolean;
}

interface PriceListOption {
  id: string;
  name: string;
  currency: string;
}

const createUserSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t("users.validation.name_required")),
    email: z.string().email(t("users.validation.email_invalid")),
    role: z.enum(["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER", "CUSTOMER"]),
    b2bStatus: z.enum(["NOT_APPLIED", "PENDING", "APPROVED", "REJECTED"]),
    customerLevel: z.string().optional(),
    priceListId: z.string().optional(),
    isActive: z.boolean().default(true),
  });

type UserFormValues = z.infer<ReturnType<typeof createUserSchema>>;

interface UserFormProps {
  initialData?: UserFormData;
  priceLists: PriceListOption[];
}

export function UserForm({ initialData, priceLists }: UserFormProps) {
  const router = useRouter();
  const t = useTranslations("admin");
  const [loading, setLoading] = useState(false);
  const userSchema = useMemo(() => createUserSchema(t), [t]);

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: initialData
      ? {
          name: initialData.name || "",
          email: initialData.email || "",
          role: initialData.role || "CUSTOMER",
          b2bStatus: initialData.b2bStatus || "NOT_APPLIED",
          customerLevel: initialData.customerLevel || "",
          priceListId: initialData.priceListId || "none",
          isActive: initialData.isActive ?? true,
        }
      : {
          name: "",
          email: "",
          role: "CUSTOMER",
          b2bStatus: "NOT_APPLIED",
          customerLevel: "",
          priceListId: "none",
          isActive: true,
        },
  });

  const onSubmit = async (data: UserFormValues) => {
    try {
      setLoading(true);
      if (initialData) {
        await updateUser(initialData.id, data);
        toast.success(t("common.messages.save_success"));
      } else {
        await createUser(data);
        toast.success(t("common.messages.save_success"));
        router.push("/admin/customers");
      }
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : t("common.messages.something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {initialData ? t("users.title_edit") : t("users.title_create")}
            </h2>
          </div>
          <Button type="submit" disabled={loading} className="bg-accent hover:bg-accent/90 text-accent-foreground font-black">
            {loading ? t("common.actions.loading") : t("common.actions.save")}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">{t("users.account_info")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.name")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("users.form_placeholders.name")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.email")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("users.form_placeholders.email")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.role")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("users.placeholders.select_role")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CUSTOMER">{t("users.roles.CUSTOMER")}</SelectItem>
                        <SelectItem value="SALES_REP">{t("users.roles.SALES_REP")}</SelectItem>
                        <SelectItem value="WAREHOUSE_MANAGER">{t("users.roles.WAREHOUSE_MANAGER")}</SelectItem>
                        <SelectItem value="ADMIN">{t("users.roles.ADMIN")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>{t("users.fields.active_account")}</FormLabel>
                      <FormDescription>
                        {t("users.descriptions.active_account")}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-all duration-200">
            <CardHeader>
              <CardTitle className="border-l-4 border-accent pl-3">{t("users.fields.b2b_pricing")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="b2bStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.b2b_status")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("users.placeholders.select_status")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NOT_APPLIED">{t("users.status_options.NOT_APPLIED")}</SelectItem>
                        <SelectItem value="PENDING">{t("users.status_options.PENDING")}</SelectItem>
                        <SelectItem value="APPROVED">{t("users.status_options.APPROVED")}</SelectItem>
                        <SelectItem value="REJECTED">{t("users.status_options.REJECTED")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.customer_level")}</FormLabel>
                    <FormControl>
                      <Input placeholder={t("users.form_placeholders.level_code")} {...field} />
                    </FormControl>
                    <FormDescription>
                      {t("users.descriptions.customer_level")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceListId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("users.fields.price_list")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("users.placeholders.select_price_list")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{t("users.placeholders.none_standard")}</SelectItem>
                        {priceLists.map((pl) => (
                          <SelectItem key={pl.id} value={pl.id}>
                            {pl.name} ({pl.currency})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t("users.descriptions.price_list")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </Form>
  );
}
