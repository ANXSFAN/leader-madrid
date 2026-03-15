"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { verifyEmail } from "@/actions/auth-actions";

export default function VerifyEmailPage() {
  const t = useTranslations("verify_email");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg(t("invalid_link"));
      return;
    }

    verifyEmail(token).then((result) => {
      if (result.error) {
        setStatus("error");
        setErrorMsg(result.error);
      } else {
        setStatus("success");
      }
    });
  }, [token, t]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p>{t("verifying")}</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h3 className="font-semibold text-lg">{t("success_title")}</h3>
              <p className="text-sm text-muted-foreground">{t("success_desc")}</p>
              <Link href="/login">
                <Button className="w-full">{t("login_now")}</Button>
              </Link>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <h3 className="font-semibold text-lg">{t("error_title")}</h3>
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
              <Link href="/login">
                <Button variant="outline" className="w-full">{t("back_to_login")}</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
