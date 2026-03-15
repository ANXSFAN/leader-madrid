import db from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getAllPriceLists } from "@/lib/actions/price-list";
import { CustomersTable } from "@/components/admin/customers-table";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationControl } from "@/components/storefront/pagination-control";
import { ExportButton } from "@/components/admin/export-button";
import { exportCustomers } from "@/lib/actions/import-export";
import { getCustomerTags } from "@/lib/actions/customer-tags";

export const dynamic = "force-dynamic";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revalidatePath } from "next/cache";

const adminRoles = ["ADMIN", "SALES_REP", "WAREHOUSE_MANAGER"];

async function requireAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const role = session.user.role as string;
  if (!adminRoles.includes(role)) return null;
  return session;
}

async function getPendingUsers() {
  const session = await requireAdminSession();
  if (!session) return [];

  return await db.user.findMany({
    where: { b2bStatus: "PENDING", role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
  });
}

const CUSTOMERS_PAGE_SIZE = 30;

async function getAllCustomers(page: number = 1, tagId?: string) {
  const session = await requireAdminSession();
  if (!session) return { customers: [], total: 0 };

  const skip = (page - 1) * CUSTOMERS_PAGE_SIZE;
  const where = tagId
    ? { role: "CUSTOMER" as const, customerTags: { some: { id: tagId } } }
    : { role: "CUSTOMER" as const };

  const [customers, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { priceLists: true, customerTags: true },
      skip,
      take: CUSTOMERS_PAGE_SIZE,
    }),
    db.user.count({ where }),
  ]);

  return { customers, total };
}

async function bulkUpdateCustomerLevel(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  if (!session) return;

  const levelCode = String(formData.get("levelCode") || "").trim();
  const applyAll = formData.get("applyAll") === "on";
  const emailsRaw = String(formData.get("emails") || "").trim();
  const nextLevel = levelCode === "" ? null : levelCode;

  if (!applyAll && emailsRaw.length === 0) {
    return;
  }

  if (applyAll) {
    await db.user.updateMany({
      where: { role: "CUSTOMER" },
      data: { customerLevel: nextLevel },
    });
  } else {
    const emails = Array.from(
      new Set(
        emailsRaw
          .split(/[\s,;]+/)
          .map((email) => email.trim())
          .filter(Boolean)
      )
    );

    if (emails.length === 0) {
      return;
    }

    await db.user.updateMany({
      where: { role: "CUSTOMER", email: { in: emails } },
      data: { customerLevel: nextLevel },
    });
  }

  revalidatePath("/admin/customers");
}

export default async function CustomersPage(
  props: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const page = typeof searchParams.page === "string" ? Number(searchParams.page) : 1;
  const tagFilter = typeof searchParams.tag === "string" ? searchParams.tag : undefined;
  const pendingUsers = await getPendingUsers();
  const { customers: allCustomers, total: totalCustomers } = await getAllCustomers(page, tagFilter);
  const totalPages = Math.ceil(totalCustomers / CUSTOMERS_PAGE_SIZE);
  const t = await getTranslations("admin.users");
  const tTags = await getTranslations("admin.customerTags");
  const priceListsResult = await getAllPriceLists();
  const priceLists = "priceLists" in priceListsResult ? priceListsResult.priceLists as { id: string; name: string }[] : [];
  const tagsResult = await getCustomerTags();
  const allTags = tagsResult.tags || [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <ExportButton
            exportAction={exportCustomers}
            label={t("export_customers")}
          />
        }
      />

      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">{tTags("title")}:</span>
          <Link
            href="/admin/customers"
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
              !tagFilter
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t("tabs.all")}
          </Link>
          {allTags.map((tag) => (
            <Link
              key={tag.id}
              href={`/admin/customers?tag=${tag.id}`}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor:
                  tagFilter === tag.id ? tag.color + "30" : tag.color + "15",
                color: tag.color,
                outline: tagFilter === tag.id ? `2px solid ${tag.color}` : "none",
              }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <span className="text-[10px] opacity-70">({tag._count.users})</span>
            </Link>
          ))}
        </div>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          <TabsTrigger value="pending">
            {t("tabs.pending")}
            {pendingUsers.length > 0 && (
              <Badge
                variant="secondary"
                className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center"
              >
                {pendingUsers.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("bulk.title")}</CardTitle>
              <CardDescription>
                {t("bulk.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={bulkUpdateCustomerLevel} className="grid gap-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t("bulk.level_code")}</label>
                  <input
                    name="levelCode"
                    placeholder="e.g. T1"
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">{t("bulk.emails")}</label>
                  <textarea
                    name="emails"
                    placeholder="email1@example.com, email2@example.com"
                    className="min-h-[96px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="applyAll" className="h-4 w-4" />
                  {t("bulk.apply_all")}
                </label>
                <div className="flex justify-end">
                  <Button type="submit">{t("bulk.apply_button")}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("tabs.all")}</CardTitle>
              <CardDescription>
                {t("subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CustomersTable
                customers={allCustomers}
                priceLists={priceLists}
              />
            </CardContent>
          </Card>
          {totalPages > 1 && (
            <div className="flex justify-end">
              <PaginationControl currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("pending_title")}</CardTitle>
              <CardDescription>
                {t("pending_description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.company")}</TableHead>
                    <TableHead>{t("table.tax_id")}</TableHead>
                    <TableHead>{t("table.contact")}</TableHead>
                    <TableHead>{t("table.industry")}</TableHead>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center h-24 text-muted-foreground"
                      >
                        {t("table.no_pending")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.companyName || "N/A"}
                        </TableCell>
                        <TableCell>{user.taxId || "N/A"}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{user.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {user.industry || "General"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/admin/customers/${user.id}`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
