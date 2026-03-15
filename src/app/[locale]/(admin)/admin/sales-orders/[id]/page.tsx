import { getSalesOrder } from "@/lib/actions/sales-order";
import { SalesOrderDetails } from "@/components/admin/sales-order-details";
import { notFound } from "next/navigation";
import { serializeDecimal } from "@/lib/serialize";

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SalesOrderDetailsPage(props: PageProps) {
  const params = await props.params;
  const so = await getSalesOrder(params.id);

  if (!so) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-4">
      <SalesOrderDetails so={serializeDecimal(so)} />
    </div>
  );
}
