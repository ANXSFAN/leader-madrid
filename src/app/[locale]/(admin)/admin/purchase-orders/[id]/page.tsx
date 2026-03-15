import { getPurchaseOrder } from "@/lib/actions/purchase-order";
import { PurchaseOrderDetails } from "@/components/admin/purchase-order-details";
import { notFound } from "next/navigation";
import { serializeDecimal } from "@/lib/serialize";

interface PurchaseOrderDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PurchaseOrderDetailPage(props: PurchaseOrderDetailPageProps) {
  const params = await props.params;
  const po = await getPurchaseOrder(params.id);

  if (!po) {
    notFound();
  }

  return (
    <div className="flex-1 space-y-4">
      <PurchaseOrderDetails po={serializeDecimal(po) as any} />
    </div>
  );
}
