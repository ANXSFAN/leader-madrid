"use client";

import { useState } from "react";
import { ArrowRight, Loader2, Check } from "lucide-react";
import { subscribeNewsletter } from "@/lib/actions/newsletter";
import { useTranslations } from "next-intl";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("footer");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await subscribeNewsletter(email);
      if (res.error) {
        setError(t(`newsletter_error_${res.error}`));
      } else {
        setSuccess(true);
        setEmail("");
      }
    } catch {
      setError(t("newsletter_error_server_error"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-sm text-accent font-medium">
        <Check size={16} />
        {t("newsletter_success")}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex border border-border bg-secondary p-1 rounded-lg">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("newsletter_email_placeholder")}
          className="bg-transparent border-none focus:ring-0 text-sm flex-1 px-3 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-accent text-accent-foreground p-2 rounded-md hover:opacity-90 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        </button>
      </div>
      {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
    </form>
  );
}
