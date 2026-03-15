import { getActiveWarehouses } from "@/lib/actions/warehouse";
import { BinLocationManager } from "@/components/admin/bin-location-manager";
import { PageHeader } from "@/components/admin/page-header";
import { getTranslations } from "next-intl/server";

export default async function BinLocationsPage() {
  const [t, warehouses] = await Promise.all([
    getTranslations("admin.binLocations"),
    getActiveWarehouses(),
  ]);

  return (
    <div className="flex-1 space-y-4">
      <PageHeader title={t("title")} />
      <BinLocationManager warehouses={warehouses} />
    </div>
  );
}
