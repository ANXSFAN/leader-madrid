import db from "@/lib/db";
import { ProductForm } from "@/components/admin/product-form";
import { ProductAuditLog } from "@/components/admin/product-audit-log";
import { Suspense } from "react";
import { serializeDecimal } from "@/lib/serialize";

interface ProductPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ProductPage(props: ProductPageProps) {
  const params = await props.params;
  const isNew = params.id === "new";

  // Fetch dependencies
  const [categories, suppliers, attributeDefinitions] = await Promise.all([
    db.category.findMany(),
    db.supplier.findMany(),
    db.attributeDefinition.findMany({
      orderBy: { key: "asc" },
      include: { options: true },
    }),
  ]);

  let product = null;

  if (!isNew) {
    product = await db.product.findUnique({
      where: { id: params.id },
      include: {
        variants: true,
        bundleItems: {
          include: {
            child: {
              include: {
                product: true,
              },
            },
          },
        },
        productSuppliers: true,
        documents: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!product) {
      return <div>Product not found</div>;
    }
  }

  return (
    <div className="flex-1 space-y-4">
      <ProductForm
        categories={categories}
        suppliers={suppliers}
        initialData={product ? serializeDecimal(product) : undefined}
        attributeDefinitions={attributeDefinitions}
      />
      {!isNew && (
        <div className="rounded-lg border bg-white p-6">
          <Suspense fallback={<div className="text-sm text-slate-400">Loading audit log...</div>}>
            <ProductAuditLog productId={params.id} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
