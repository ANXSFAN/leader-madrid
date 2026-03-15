import db from "@/lib/db";
import { InventoryHistoryTable } from "@/components/admin/inventory-history-table";
import { InventoryHistoryFilter } from "@/components/admin/inventory-history-filter";
import { PaginationControl } from "@/components/storefront/pagination-control";
import { InventoryType, Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { exportInventory } from "@/lib/actions/import-export";

export const dynamic = "force-dynamic";

async function getTransactions(
  page: number,
  pageSize: number,
  query?: string,
  type?: string
) {
  const skip = (page - 1) * pageSize;
  const where: Prisma.InventoryTransactionWhereInput = {};

  if (type && type !== "ALL") {
    if (Object.values(InventoryType).includes(type as InventoryType)) {
      where.type = type as InventoryType;
    }
  }

  if (query) {
    where.OR = [
      {
        variant: {
          sku: { contains: query, mode: "insensitive" },
        },
      },
      {
        variant: {
          product: {
            content: {
              path: ["en", "name"],
              string_contains: query,
            },
          },
        },
      },
      {
        variant: {
          product: {
            content: {
              path: ["es", "name"],
              string_contains: query,
            },
          },
        },
      },
      { reference: { contains: query, mode: "insensitive" } },
    ];
  }

  const [transactions, total] = await Promise.all([
    db.inventoryTransaction.findMany({
      where,
      include: {
        variant: {
          include: {
            product: true,
          },
        },
        warehouse: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.inventoryTransaction.count({ where }),
  ]);

  return { transactions, total };
}

export default async function InventoryPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const pageSize = 20;
  const query = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const type = typeof searchParams.type === "string" ? searchParams.type : undefined;

  const [{ transactions, total }, t] = await Promise.all([
    getTransactions(page, pageSize, query, type),
    getTranslations("admin.inventory"),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <ExportButton
            exportAction={exportInventory}
            label={t("export_inventory")}
          />
        }
      />

      <InventoryHistoryFilter />

      <InventoryHistoryTable transactions={transactions} />

      <div className="flex justify-end">
        <PaginationControl currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  );
}
