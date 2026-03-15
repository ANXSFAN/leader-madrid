import db from "@/lib/db";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { SupplierFormDialog } from "@/components/admin/supplier-form-dialog";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/admin/page-header";
import { ExportButton } from "@/components/admin/export-button";
import { exportSuppliers } from "@/lib/actions/import-export";

export default async function SuppliersPage() {
  const [suppliers, t] = await Promise.all([
    db.supplier.findMany({
      orderBy: { name: "asc" },
    }),
    getTranslations("admin.suppliers"),
  ]);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title={t("title")}
        description={t("subtitle")}
        actions={
          <>
            <ExportButton
              exportAction={exportSuppliers}
              label={t("export_suppliers")}
            />
            <SupplierFormDialog>
              <Button className="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-black">
                <Plus className="mr-2 h-4 w-4" /> {t("actions.add")}
              </Button>
            </SupplierFormDialog>
          </>
        }
      />

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead>{t("table.contact")}</TableHead>
              <TableHead>{t("table.email")}</TableHead>
              <TableHead>{t("table.phone")}</TableHead>
              <TableHead>{t("table.website")}</TableHead>
              <TableHead className="w-[100px]">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            ) : (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell>{(supplier.contact as Record<string, string> | null)?.contactName || "-"}</TableCell>
                  <TableCell>{(supplier.contact as Record<string, string> | null)?.email || "-"}</TableCell>
                  <TableCell>{(supplier.contact as Record<string, string> | null)?.phone || "-"}</TableCell>
                  <TableCell>
                    {(supplier.contact as Record<string, string> | null)?.website ? (
                      <a
                        href={(supplier.contact as Record<string, string>).website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center hover:underline text-blue-600"
                      >
                        {t("actions.visit")} <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <SupplierFormDialog supplier={supplier}>
                        <Button variant="ghost" size="icon">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </SupplierFormDialog>
                      {/* Delete button could go here */}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
