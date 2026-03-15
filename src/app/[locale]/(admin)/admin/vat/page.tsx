import { getVATConfigs, seedEUVATRates } from "@/lib/actions/vat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeedVATButton } from "./seed-vat-button";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function VATConfigPage() {
  const [configs, t] = await Promise.all([
    getVATConfigs(),
    getTranslations("admin.vat"),
  ]);

  const euConfigs = configs.filter((c) => c.isEU);
  const nonEUConfigs = configs.filter((c) => !c.isEU);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={<SeedVATButton hasData={configs.length > 0} />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("stats.configured")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{configs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("stats.eu")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {euConfigs.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("stats.spain_standard")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">21%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("rules.title")}</CardTitle>
          <CardDescription>
            {t("rules.subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 border rounded-lg bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t("rules.cards.es_es.title")}
              </p>
              <p className="text-sm font-bold mt-1">{t("rules.cards.es_es.rate")}</p>
              <p className="text-xs text-slate-500">{t("rules.cards.es_es.desc")}</p>
            </div>
            <div className="p-3 border rounded-lg bg-blue-50">
              <p className="text-xs font-semibold text-blue-600 uppercase">
                {t("rules.cards.es_eu_b2b.title")}
              </p>
              <p className="text-sm font-bold mt-1 text-blue-800">{t("rules.cards.es_eu_b2b.rate")}</p>
              <p className="text-xs text-blue-600">
                {t("rules.cards.es_eu_b2b.desc")}
              </p>
            </div>
            <div className="p-3 border rounded-lg bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase">
                {t("rules.cards.es_eu_b2c.title")}
              </p>
              <p className="text-sm font-bold mt-1">{t("rules.cards.es_eu_b2c.rate")}</p>
              <p className="text-xs text-slate-500">{t("rules.cards.es_eu_b2c.desc")}</p>
            </div>
            <div className="p-3 border rounded-lg bg-green-50">
              <p className="text-xs font-semibold text-green-600 uppercase">
                {t("rules.cards.es_non_eu.title")}
              </p>
              <p className="text-sm font-bold mt-1 text-green-800">
                {t("rules.cards.es_non_eu.rate")}
              </p>
              <p className="text-xs text-green-600">{t("rules.cards.es_non_eu.desc")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground mb-4">
              {t("empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t("table.title")}</CardTitle>
            <CardDescription>
              {t("table.subtitle", { year: new Date().getFullYear() })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.country")}</TableHead>
                  <TableHead>{t("table.code")}</TableHead>
                  <TableHead className="text-right">{t("table.standard")}</TableHead>
                  <TableHead className="text-right">{t("table.reduced")}</TableHead>
                  <TableHead>{t("table.zone")}</TableHead>
                  <TableHead>{t("table.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-medium">
                      {config.countryName}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">
                        {config.countryCode}
                      </code>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {Number(config.standardRate)}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {config.reducedRate
                        ? `${Number(config.reducedRate)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={config.isEU ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {config.isEU ? t("table.eu") : t("table.non_eu")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={config.isActive ? "outline" : "destructive"}
                        className="text-xs"
                      >
                        {config.isActive ? t("table.active") : t("table.inactive")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
