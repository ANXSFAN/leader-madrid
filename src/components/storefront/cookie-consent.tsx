"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Cookie, X, ChevronDown, ChevronUp } from "lucide-react";

const CONSENT_COOKIE = "cookie_consent";
const CONSENT_VERSION = "1";

type ConsentCategories = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_CONSENT: ConsentCategories = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
};

const ALL_ACCEPTED: ConsentCategories = {
  necessary: true,
  functional: true,
  analytics: true,
  marketing: true,
};

function getStoredConsent(): ConsentCategories | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
      ?.split("=")[1];
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed.categories;
  } catch {
    return null;
  }
}

function setConsentCookie(categories: ConsentCategories) {
  const value = encodeURIComponent(
    JSON.stringify({ version: CONSENT_VERSION, categories })
  );
  const maxAge = 365 * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent("cookie-consent-update", { detail: categories }));
}

export function CookieConsent() {
  const t = useTranslations("cookie_consent");
  const [visible, setVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consent, setConsent] = useState<ConsentCategories>(DEFAULT_CONSENT);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
    setConsent(stored);
  }, []);

  useEffect(() => {
    function handleOpenSettings() {
      setVisible(true);
      setShowDetails(true);
      setConsent(getStoredConsent() || DEFAULT_CONSENT);
    }
    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => window.removeEventListener("open-cookie-settings", handleOpenSettings);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setConsentCookie(ALL_ACCEPTED);
    setConsent(ALL_ACCEPTED);
    setVisible(false);
  }, []);

  const handleRejectNonEssential = useCallback(() => {
    setConsentCookie(DEFAULT_CONSENT);
    setConsent(DEFAULT_CONSENT);
    setVisible(false);
  }, []);

  const handleSavePreferences = useCallback(() => {
    setConsentCookie(consent);
    setVisible(false);
  }, [consent]);

  const toggleCategory = (key: keyof Omit<ConsentCategories, "necessary">) => {
    setConsent((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 md:p-6">
      <div className="max-w-3xl mx-auto bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 md:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2.5">
              <Cookie className="h-5 w-5 text-accent shrink-0" />
              <h3 className="text-base font-bold text-foreground">{t("title")}</h3>
            </div>
            <button
              onClick={handleRejectNonEssential}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label={t("close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            {t("description")}{" "}
            <Link href="/legal/cookie-policy" className="text-accent hover:underline font-medium">
              {t("learn_more")}
            </Link>
          </p>

          {/* Details Toggle */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            {showDetails ? (
              <>
                <ChevronUp className="h-4 w-4" />
                {t("hide_details")}
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {t("show_details")}
              </>
            )}
          </button>

          {/* Category Details */}
          {showDetails && (
            <div className="space-y-3 mb-5 border border-border rounded-xl p-4 bg-secondary/30">
              {/* Necessary */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("cat_necessary")}</p>
                  <p className="text-xs text-muted-foreground">{t("cat_necessary_desc")}</p>
                </div>
                <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  {t("always_active")}
                </span>
              </div>

              {/* Functional */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("cat_functional")}</p>
                  <p className="text-xs text-muted-foreground">{t("cat_functional_desc")}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.functional}
                    onChange={() => toggleCategory("functional")}
                    className="sr-only peer"
                    aria-label={t("cat_functional")}
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Analytics */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("cat_analytics")}</p>
                  <p className="text-xs text-muted-foreground">{t("cat_analytics_desc")}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.analytics}
                    onChange={() => toggleCategory("analytics")}
                    className="sr-only peer"
                    aria-label={t("cat_analytics")}
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Marketing */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("cat_marketing")}</p>
                  <p className="text-xs text-muted-foreground">{t("cat_marketing_desc")}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consent.marketing}
                    onChange={() => toggleCategory("marketing")}
                    className="sr-only peer"
                    aria-label={t("cat_marketing")}
                  />
                  <div className="w-9 h-5 bg-muted rounded-full peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-card after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleRejectNonEssential}
              className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors text-foreground"
            >
              {t("reject_all")}
            </button>
            {showDetails && (
              <button
                onClick={handleSavePreferences}
                className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-xl hover:bg-secondary transition-colors text-foreground"
              >
                {t("save_preferences")}
              </button>
            )}
            <button
              onClick={handleAcceptAll}
              className="flex-1 px-4 py-2.5 text-sm font-bold bg-accent text-accent-foreground rounded-xl hover:opacity-90 transition-opacity"
            >
              {t("accept_all")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsButton({ className }: { className?: string }) {
  const t = useTranslations("cookie_consent");

  return (
    <button
      onClick={() => window.dispatchEvent(new Event("open-cookie-settings"))}
      className={className}
    >
      {t("cookie_settings")}
    </button>
  );
}
