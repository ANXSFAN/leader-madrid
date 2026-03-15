import { getQuickStockInById } from "@/lib/actions/purchase-stock-in";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLocalized } from "@/lib/content";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default async function PurchaseStockInDetailPage(props: PageProps) {
  const { id, locale } = await props.params;

  const po = await getQuickStockInById(id);
  if (!po) {
    notFound();
  }

  const t = await getTranslations("admin.purchaseStockIn");

  const items = po.items.map((item) => {
    const content = item.variant?.product?.content;
    const { name } = getLocalized(content, locale);

    return {
      id: item.id,
      name,
      sku: item.variant?.sku || "-",
      quantity: item.quantity,
      unitPrice: item.costPrice,
      subtotal: item.total,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/purchase-stock-in">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("detail.back")}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("detail_title")}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.po_number")}: {po.poNumber}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t("detail.date")}
              </dt>
              <dd className="mt-1 text-sm">
                {new Date(po.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t("detail.supplier")}
              </dt>
              <dd className="mt-1 text-sm">{po.supplier.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t("detail.warehouse")}
              </dt>
              <dd className="mt-1 text-sm">{po.warehouse?.name || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {t("detail.reference")}
              </dt>
              <dd className="mt-1 text-sm">{po.poNumber}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">
                {t("detail.note")}
              </dt>
              <dd className="mt-1 text-sm">{po.note || "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("detail.items")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("detail.product")}</TableHead>
                  <TableHead>{t("detail.sku")}</TableHead>
                  <TableHead className="text-right">{t("detail.qty")}</TableHead>
                  <TableHead className="text-right">{t("detail.unit_price")}</TableHead>
                  <TableHead className="text-right">{t("detail.subtotal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell className="font-mono text-sm">{item.sku}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.unitPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.subtotal.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="text-right">
              <span className="text-sm font-medium text-muted-foreground">
                {t("detail.total")}:
              </span>
              <span className="ml-4 text-lg font-bold font-mono">
                {po.totalAmount.toFixed(2)} {po.currency}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
