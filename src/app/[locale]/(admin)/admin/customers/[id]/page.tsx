import { getUser } from "@/lib/actions/user";
import { getAllPriceLists } from "@/lib/actions/price-list";
import { getModuleToggles } from "@/lib/actions/config";
import { getCustomerTags } from "@/lib/actions/customer-tags";
import { UserForm } from "@/components/admin/user-form";
import { B2BApplicationPanel } from "@/components/admin/b2b-application-panel";
import { CustomerPricingPanel } from "@/components/admin/customer-pricing-panel";
import { CustomerCreditPanel } from "@/components/admin/customer-credit-panel";
import { CustomerTagAssign } from "@/components/admin/customer-tag-assign";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface UserDetailsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function UserDetailsPage(props: UserDetailsPageProps) {
  const params = await props.params;
  const [{ user, error }, { priceLists }, moduleToggles, tagsResult, t] = await Promise.all([
    getUser(params.id),
    getAllPriceLists(),
    getModuleToggles(),
    getCustomerTags(),
    getTranslations("admin.customerTags"),
  ]);

  if (error || !user) {
    notFound();
  }

  const userPriceList = user.priceLists?.[0] || null;
  const allTags = (tagsResult.tags || []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
  const assignedTags = ((user as { customerTags?: Array<{ id: string; name: string; color: string }> }).customerTags || []).map((tag) => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));

  return (
    <div className="space-y-6">
      {user.b2bStatus !== "NOT_APPLIED" && (
        <B2BApplicationPanel user={user} />
      )}
      <Card>
        <CardHeader>
          <CardTitle className="border-l-4 border-yellow-500 pl-3">
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerTagAssign
            userId={user.id}
            assignedTags={assignedTags}
            allTags={allTags}
          />
        </CardContent>
      </Card>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma user shape wider than UserFormData */}
      <UserForm initialData={user as any} priceLists={(priceLists || []) as any} />
      <CustomerPricingPanel
        userId={user.id}
        userName={user.name || user.email || "Customer"}
        priceList={userPriceList}
      />
      {moduleToggles.credit_management && (
        <CustomerCreditPanel
          userId={user.id}
          creditLimit={user.creditLimit ? Number(user.creditLimit) : null}
          paymentTermsDays={user.paymentTermsDays ?? 0}
          currentBalance={Number(user.currentBalance ?? 0)}
        />
      )}
    </div>
  );
}
