import { getSiteSettings } from "@/lib/actions/config";
import { ShippingMethodFormClient } from "../_components/shipping-method-form";

export default async function NewShippingMethodPage() {
  const settings = await getSiteSettings();
  return <ShippingMethodFormClient currency={settings.currency} />;
}
