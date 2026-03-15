import db from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";
import { getSiteSettings } from "@/lib/actions/config";
import { OrdersTable } from "@/components/admin/orders-table";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControl } from "@/components/storefront/pagination-control";
import { OrderSearch } from "@/components/admin/order-search";
import { OrderFilter } from "@/components/admin/order-filter";
import { ExportOrdersButton } from "@/components/admin/export-orders-button";
import { Prisma } from "@prisma/client";
import { serializeDecimal } from "@/lib/serialize";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AdminOrdersPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const settings = await getSiteSettings();
  const currency = settings.currency;
  const t = await getTranslations("admin.orders");

  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const skip = (page - 1) * PAGE_SIZE;

  // Search query
  const query = typeof searchParams.q === "string" ? searchParams.q.trim() : "";

  // Filters
  const statusFilter = typeof searchParams.status === "string" ? searchParams.status : "";
  const paymentStatusFilter = typeof searchParams.paymentStatus === "string" ? searchParams.paymentStatus : "";

  // Sort
  const sort = typeof searchParams.sort === "string" ? searchParams.sort : "newest";

  // Build where clause
  const where: Prisma.OrderWhereInput = {};

  if (query) {
    where.OR = [
      { orderNumber: { contains: query, mode: "insensitive" } },
      { poNumber: { contains: query, mode: "insensitive" } },
      { user: { name: { contains: query, mode: "insensitive" } } },
      { user: { email: { contains: query, mode: "insensitive" } } },
    ];
  }

  if (statusFilter) {
    where.status = statusFilter as any;
  }

  if (paymentStatusFilter) {
    where.paymentStatus = paymentStatusFilter as any;
  }

  // Build orderBy
  let orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: "desc" };
  switch (sort) {
    case "oldest":
      orderBy = { createdAt: "asc" };
      break;
    case "total_asc":
      orderBy = { total: "asc" };
      break;
    case "total_desc":
      orderBy = { total: "desc" };
      break;
    default:
      orderBy = { createdAt: "desc" };
  }

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      include: {
        user: true,
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
      },
      orderBy,
      skip,
      take: PAGE_SIZE,
    }),
    db.order.count({ where }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const serialized = serializeDecimal(orders);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <OrderSearch />
        <OrderFilter />
        <ExportOrdersButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("subtitle")} ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersTable
            orders={serialized}
            currency={currency}
          />
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex justify-end">
          <PaginationControl currentPage={page} totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
