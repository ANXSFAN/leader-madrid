"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslations } from "next-intl";
import { Bell, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RestockNotifyProps {
  productName: string;
  variantId?: string;
}

export function RestockNotify({ productName, variantId }: RestockNotifyProps) {
  const t = useTranslations("product");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("Por favor, introduce un correo electrónico válido");
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setIsSubscribed(true);
      toast.success(t("notify_success"));
    } catch (error) {
      toast.error(t("notify_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubscribed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-green-600" />
        </div>
        <h4 className="font-semibold text-green-800 mb-1">
          {t("notify_subscribed_title")}
        </h4>
        <p className="text-base text-green-700">
          {t("notify_subscribed_desc")}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Bell className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-foreground mb-1">
            {t("notify_title")}
          </h4>
          <p className="text-base text-muted-foreground mb-3">
            {t("notify_desc")}
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              type="email"
              placeholder={t("email_placeholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-card"
              required
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent hover:bg-accent/90 whitespace-nowrap"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                t("notify_btn")
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
