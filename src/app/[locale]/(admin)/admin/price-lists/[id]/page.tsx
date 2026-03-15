import { getPriceList } from "@/lib/actions/price-list";
import { PriceListForm } from "@/components/admin/price-list-form";
import { PriceListRulesTable } from "@/components/admin/price-list-rules-table";
import { PriceListCsvImport } from "@/components/admin/price-list-csv-import";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { serializeDecimal } from "@/lib/serialize";

interface PriceListDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PriceListDetailsPage(props: PriceListDetailsPageProps) {
  const params = await props.params;
  const { priceList, error } = await getPriceList(params.id);
  const t = await getTranslations("admin.priceLists.edit_page");

  if (error || !priceList) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description", { name: priceList.name })}
        </p>
      </div>

      <div className="grid gap-8">
        <PriceListForm initialData={serializeDecimal(priceList)} />

        <PriceListCsvImport priceListId={priceList.id} />

        <div className="border-t pt-8">
          <PriceListRulesTable
            priceListId={priceList.id}
            rules={serializeDecimal(priceList.rules) as any[]}
            currency={priceList.currency}
          />
        </div>
      </div>
    </div>
  );
}
