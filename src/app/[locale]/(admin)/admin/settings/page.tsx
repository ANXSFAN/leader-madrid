import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { LanguageSelect } from "@/components/admin/language-select";
import { PageHeader } from "@/components/admin/page-header";
import { getThemeConfig, getModuleToggles } from "@/lib/actions/config";
import { ThemeForm } from "./theme-form";
import { ModuleTogglesForm } from "./module-toggles-form";
import { isSuperAdmin } from "@/lib/super-admin";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  pt: "Português",
  nl: "Nederlands",
  pl: "Polski",
};

export default async function SettingsPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const t = await getTranslations("admin.settings");
  const themeConfig = await getThemeConfig();
  const moduleToggles = await getModuleToggles();
  const session = await getServerSession(authOptions);
  const showModuleToggles = isSuperAdmin(session?.user?.email);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <PageHeader
        title={t("title")}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>{t("language_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t("language_desc")}</p>
          <LanguageSelect
            locales={SUPPORTED_LOCALES}
            labels={LANGUAGE_LABELS}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("theme_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeForm initialConfig={themeConfig} />
        </CardContent>
      </Card>

      {showModuleToggles && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("modules_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ModuleTogglesForm initialToggles={moduleToggles} />
          </CardContent>
        </Card>
      )}

      <div className="p-4 border rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
    </div>
  );
}
