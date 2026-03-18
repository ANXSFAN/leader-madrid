import { Link } from "@/i18n/navigation";
import { getSiteSettings } from "@/lib/actions/config";
import { getTranslations } from "next-intl/server";
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
} from "lucide-react";
import { NewsletterForm } from "./newsletter-form";
import { CookieSettingsFooter } from "./cookie-settings-footer";

export async function Footer() {
  const settings = await getSiteSettings();
  const t = await getTranslations("footer");

  // Fallback links if settings.footerColumns is empty
  const footerColumns =
    settings.footerColumns && settings.footerColumns.length > 0
      ? settings.footerColumns
      : [
          {
            title: t("quick_links"),
            links: [
              { label: t("home"), href: "/" },
              { label: t("all_products"), href: "/search" },
              { label: t("b2b_program"), href: "/apply-b2b" },
              { label: t("my_account"), href: "/profile" },
            ],
          },
          {
            title: t("legal"),
            links: [
              { label: t("terms"), href: "/legal/terms" },
              { label: t("privacy"), href: "/legal/privacy" },
              { label: t("returns"), href: "/legal/returns" },
              { label: t("shipping"), href: "/legal/shipping" },
              { label: t("cookie_policy"), href: "/legal/cookie-policy" },
            ],
          },
        ];

  return (
    <footer className="border-t border-border bg-card text-muted-foreground py-20">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <img src="/logo.jpg" alt={settings.siteName || "Leader Madrid"} className="h-10 object-contain rounded" />
          </div>
          <p className="text-base leading-relaxed">
            {t("description")}
          </p>
          <div className="flex gap-4">
            {(
              [
                { key: "facebook", Icon: Facebook },
                { key: "instagram", Icon: Instagram },
                { key: "linkedin", Icon: Linkedin },
                { key: "twitter", Icon: Twitter },
                { key: "youtube", Icon: Youtube },
              ] as const
            ).map(({ key, Icon }) => {
              const url =
                settings.socialLinks?.[
                  key as keyof typeof settings.socialLinks
                ];
              if (!url) return null;
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 border border-border rounded-lg flex items-center justify-center hover:border-accent hover:text-accent transition-all cursor-pointer"
                >
                  <Icon size={18} />
                </a>
              );
            })}
          </div>
        </div>

        {/* Dynamic Columns */}
        {footerColumns.map((col, idx) => (
          <div key={idx}>
            <h4 className="text-base font-bold uppercase tracking-widest text-foreground mb-6">
              {col.title}
            </h4>
            <ul className="space-y-3 text-base">
              {col.links.map((link, i) => (
                <li key={i}>
                  <Link href={link.href} className="hover:text-accent transition-colors">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Newsletter */}
        <div>
          <h4 className="text-base font-bold uppercase tracking-widest text-foreground mb-6">
            {t("newsletter_title")}
          </h4>
          <p className="text-sm mb-4">
            {t("newsletter_description")}
          </p>
          <NewsletterForm />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-20 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-[11px] uppercase font-bold tracking-[0.2em]">
        <span>© {new Date().getFullYear()} {settings.siteName}. {t("rights_reserved")}</span>
        <CookieSettingsFooter />
      </div>
    </footer>
  );
}
