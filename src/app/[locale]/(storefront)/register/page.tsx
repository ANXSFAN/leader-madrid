"use client";

import { useState } from "react";
import { registerUser } from "@/actions/auth-actions";
import { signIn } from "next-auth/react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations, useLocale } from "next-intl";

export default function RegisterPage() {
  const t = useTranslations("register");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function onGoogleSignIn() {
    setLoading(true);
    await signIn("google", { callbackUrl: `/${locale}` });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const result = await registerUser(formData);

    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  }

  if (success) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl shadow-yellow-900/5 border border-gray-100 p-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t("success_title")}
          </h2>
          <p className="text-gray-500 text-sm mb-8">{t("success_desc")}</p>
          <Link
            href="/login"
            className="block w-full bg-yellow-500 text-yellow-950 py-3 rounded-xl font-bold shadow-lg shadow-yellow-500/20 hover:bg-yellow-400 active:scale-[0.98] transition-all text-center"
          >
            {t("login_now")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-[400px] bg-white rounded-2xl shadow-2xl shadow-yellow-900/5 border border-gray-100 p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 text-sm mt-2">{t("subtitle")}</p>
        </div>

        {/* Google */}
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full py-2.5 border border-gray-300 rounded-xl hover:bg-yellow-50 hover:border-yellow-200 transition-all font-medium text-gray-700 mb-6 group disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="group-hover:text-yellow-700">{t("google_button")}</span>
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-4 text-gray-400">{t("or")}</span>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
              {t("full_name")}
            </label>
            <input
              id="name"
              name="name"
              required
              placeholder={t("full_name_placeholder")}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:bg-white focus:border-transparent outline-none transition-all text-sm placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
              {t("email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder={t("email_placeholder")}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:bg-white focus:border-transparent outline-none transition-all text-sm placeholder:text-gray-300"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
              {t("password")}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:bg-white focus:border-transparent outline-none transition-all text-sm placeholder:text-gray-300"
            />
          </div>

          {/* Privacy Policy Consent */}
          <div className="flex items-start gap-2.5">
            <input
              id="privacy_consent"
              name="privacy_consent"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-gray-300 accent-yellow-500"
            />
            <label htmlFor="privacy_consent" className="text-xs text-gray-500 leading-relaxed">
              {t("privacy_consent_prefix")}{" "}
              <Link href="/legal/privacy" className="text-yellow-600 font-bold hover:underline" target="_blank">
                {t("privacy_policy")}
              </Link>{" "}
              {t("privacy_consent_suffix")}
            </label>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-500 text-yellow-950 py-3 rounded-xl font-bold shadow-lg shadow-yellow-500/20 hover:bg-yellow-400 active:scale-[0.98] transition-all mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("submit")}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-8">
          {t("has_account")}{" "}
          <Link href="/login" className="text-yellow-600 font-bold hover:underline">
            {t("login_link")}
          </Link>
        </p>
      </div>
    </div>
  );
}
