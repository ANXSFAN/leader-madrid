"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("Storefront error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h2 className="text-xl font-bold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground max-w-md text-center">
        {t("description")}
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="outline">
          {t("try_again")}
        </Button>
        <Button asChild>
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
    </div>
  );
}
