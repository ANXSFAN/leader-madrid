import { getOrdersForCustomsLinking } from "@/lib/actions/customs";
import { CustomsDeclarationForm } from "@/components/admin/customs-declaration-form";

export default async function NewCustomsDeclarationPage() {
  const { purchaseOrders, salesOrders } = await getOrdersForCustomsLinking();
  return (
    <div className="flex-1 space-y-4">
      <CustomsDeclarationForm
        purchaseOrders={purchaseOrders}
        salesOrders={salesOrders}
      />
    </div>
  );
}
