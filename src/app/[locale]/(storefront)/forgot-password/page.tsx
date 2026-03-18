"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link } from "@/i18n/navigation";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { requestPasswordReset } from "@/actions/auth-actions";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgot_password");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const formSchema = z.object({
    email: z.string().email(t("error_email")),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    await requestPasswordReset(values.email);
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-[400px] bg-card rounded-2xl shadow-2xl shadow-accent/5 border border-border p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-muted-foreground text-sm mt-2">{t("subtitle")}</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="font-bold text-lg text-foreground">{t("sent_title")}</h3>
            <p className="text-sm text-muted-foreground">{t("sent_desc")}</p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-accent font-semibold hover:text-accent/80 text-sm mt-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("back_to_login")}
            </Link>
          </div>
        ) : (
          <>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 ml-1">
                        {t("email")}
                      </label>
                      <FormControl>
                        <input
                          type="email"
                          placeholder={t("email_placeholder")}
                          autoComplete="email"
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

            {/* Back to login */}
            <p className="text-center mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-accent font-semibold hover:text-accent/80 text-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("back_to_login")}
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
