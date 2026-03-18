"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Loader2, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { resetPassword } from "@/actions/auth-actions";

export default function ResetPasswordPage() {
  const t = useTranslations("reset_password");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formSchema = z
    .object({
      password: z.string().min(6, t("error_password_min")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("error_password_match"),
      path: ["confirmPassword"],
    });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) return;
    setLoading(true);
    setError(null);

    const result = await resetPassword(token, values.password);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  // Invalid / missing token state
  if (!token) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-2xl shadow-accent/5 border border-border p-8 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground font-medium mb-6">{t("invalid_link")}</p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-accent font-semibold hover:text-accent/80 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("request_new_link")}
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-2xl shadow-accent/5 border border-border p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {t("success_title")}
          </h2>
          <p className="text-muted-foreground text-sm mb-8">{t("success_desc")}</p>
          <Link
            href="/login"
            className="block w-full bg-accent text-accent-foreground py-3 rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all text-center"
          >
            {t("login_now")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-2xl shadow-accent/5 border border-border p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-2">{t("subtitle")}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">
                    {t("new_password")}
                  </label>
                  <FormControl>
                    <input
                      type="password"
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:ring-2 focus:ring-accent focus:bg-card focus:border-transparent outline-none transition-all text-sm placeholder:text-muted-foreground/40 disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">
                    {t("confirm_password")}
                  </label>
                  <FormControl>
                    <input
                      type="password"
                      placeholder="••••••••"
                      disabled={loading}
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-xl focus:ring-2 focus:ring-accent focus:bg-card focus:border-transparent outline-none transition-all text-sm placeholder:text-muted-foreground/40 disabled:opacity-50"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-accent-foreground py-3 rounded-xl font-bold shadow-lg shadow-accent/20 hover:bg-accent/90 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("submit")}
            </button>
          </form>
        </Form>

        {/* Footer */}
        <p className="text-center mt-8">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-accent font-semibold hover:text-accent/80 text-sm"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("request_new_link")}
          </Link>
        </p>
      </div>
    </div>
  );
}
