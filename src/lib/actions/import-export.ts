"use server";

import db from "@/lib/db";
import { requireRole } from "@/lib/auth-guard";
import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";

// --- Types ---

export type ImportResult = {
  success: boolean;
  count: number;
  errors: string[];
};

export type ExportResult = {
  success: boolean;
  data?: string; // Base64 encoded file
  filename?: string;
  error?: string;
};

// --- Actions ---

export async function exportProducts(): Promise<ExportResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    // 1. Fetch all products with variants, categories, and suppliers
    const products = await db.product.findMany({
      include: {
        category: true,
        supplier: true,
        variants: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Create Workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Products");

    // 3. Define Columns
    worksheet.columns = [
      { header: "Handle (Slug)", key: "handle", width: 20 },
      { header: "Name (EN)", key: "name", width: 40 },
      { header: "SKU", key: "sku", width: 20 }, // Variant level
      { header: "Price", key: "price", width: 15 },
      { header: "Stock", key: "stock", width: 10 },
      { header: "Category", key: "category", width: 20 },
      { header: "Supplier", key: "supplier", width: 20 },
      { header: "Status", key: "status", width: 15 }, // Active/Inactive
    ];

    // 4. Add Rows
    for (const product of products) {
      const productContent = product.content as Record<string, Record<string, string>> | null;
      const productName =
        productContent?.en?.name ||
        productContent?.es?.name ||
        product.slug;
      const categoryContent = product.category?.content as Record<string, Record<string, string>> | null;
      const categoryName = categoryContent?.es?.name || categoryContent?.en?.name || product.category?.slug || "";
      const supplierName = product.supplier?.name || "";
      const status = product.isActive ? "Active" : "Inactive";

      if (product.variants.length === 0) {
        // Product without variants (shouldn't happen often but possible)
        worksheet.addRow({
          handle: product.slug,
          name: productName,
          sku: "",
          price: 0,
          stock: 0,
          category: categoryName,
          supplier: supplierName,
          status: status,
        });
      } else {
        for (const variant of product.variants) {
          worksheet.addRow({
            handle: product.slug,
            name: productName,
            sku: variant.sku,
            price: Number(variant.price),
            stock: variant.physicalStock,
            category: categoryName,
            supplier: supplierName,
            status: status,
          });
        }
      }
    }

    // 5. Generate Buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const date = new Date().toISOString().split("T")[0];

    return {
      success: true,
      data: base64,
      filename: `products_export_${date}.xlsx`,
    };
  } catch (error) {
    console.error("Export error:", error);
    return { success: false, error: "Failed to export products" };
  }
}

export async function exportOrders(): Promise<ExportResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const orders = await db.order.findMany({
      include: {
        user: true,
        items: {
          include: {
            variant: {
              include: { product: true },
            },
          },
        },
        shippingAddress: true,
        shippingMethod: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Orders");

    worksheet.columns = [
      { header: "Order Number", key: "orderNumber", width: 18 },
      { header: "Date", key: "date", width: 20 },
      { header: "Customer", key: "customer", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Status", key: "status", width: 15 },
      { header: "Payment Status", key: "paymentStatus", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 18 },
      { header: "Subtotal", key: "subtotal", width: 12 },
      { header: "Tax", key: "tax", width: 12 },
      { header: "Shipping", key: "shipping", width: 12 },
      { header: "Total", key: "total", width: 12 },
      { header: "Currency", key: "currency", width: 10 },
      { header: "Items", key: "items", width: 40 },
      { header: "PO Number", key: "poNumber", width: 18 },
      { header: "Tracking Number", key: "tracking", width: 25 },
      { header: "Shipping Status", key: "shippingStatus", width: 15 },
      { header: "Address", key: "address", width: 40 },
    ];

    for (const order of orders) {
      const itemsSummary = order.items
        .map((item) => `${item.quantity}x ${item.variant.sku}`)
        .join(", ");

      const addr = order.shippingAddress;
      const addressStr = addr
        ? `${addr.firstName} ${addr.lastName}, ${addr.street}, ${addr.zipCode} ${addr.city}, ${addr.country}`
        : "";

      worksheet.addRow({
        orderNumber: order.orderNumber,
        date: order.createdAt.toISOString().replace("T", " ").slice(0, 19),
        customer: order.user?.name || "",
        email: order.user?.email || "",
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod || "",
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        total: Number(order.total),
        currency: order.currency,
        items: itemsSummary,
        poNumber: order.poNumber || "",
        tracking: order.trackingNumber || "",
        shippingStatus: order.shippingStatus,
        address: addressStr,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const date = new Date().toISOString().split("T")[0];

    return {
      success: true,
      data: base64,
      filename: `orders_export_${date}.xlsx`,
    };
  } catch (error) {
    console.error("Export orders error:", error);
    return { success: false, error: "Failed to export orders" };
  }
}

export async function exportInventory(): Promise<ExportResult> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const variants = await db.productVariant.findMany({
      include: {
        product: true,
        warehouseStocks: {
          include: { warehouse: { select: { name: true } } },
        },
      },
      orderBy: { sku: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Inventory");

    worksheet.columns = [
      { header: "SKU", key: "sku", width: 20 },
      { header: "Product Name", key: "productName", width: 40 },
      { header: "Physical Stock", key: "physicalStock", width: 15 },
      { header: "Allocated", key: "allocated", width: 15 },
      { header: "Available", key: "available", width: 15 },
      { header: "Min Stock", key: "minStock", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Warehouses", key: "warehouses", width: 40 },
    ];

    for (const variant of variants) {
      const productContent = variant.product.content as Record<
        string,
        Record<string, string>
      > | null;
      const productName =
        productContent?.en?.name ||
        productContent?.es?.name ||
        variant.product.slug;

      const available = variant.physicalStock - variant.allocatedStock;
      let status = "OK";
      if (variant.physicalStock <= 0) {
        status = "Out";
      } else if (
        variant.minStock !== null &&
        variant.physicalStock <= variant.minStock
      ) {
        status = "Low";
      }

      const warehouseInfo = variant.warehouseStocks
        .map((ws) => `${ws.warehouse.name}: ${ws.physicalStock}`)
        .join(", ");

      worksheet.addRow({
        sku: variant.sku,
        productName,
        physicalStock: variant.physicalStock,
        allocated: variant.allocatedStock,
        available,
        minStock: variant.minStock ?? 0,
        status,
        warehouses: warehouseInfo || "-",
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const date = new Date().toISOString().split("T")[0];

    return {
      success: true,
      data: base64,
      filename: `inventory_export_${date}.xlsx`,
    };
  } catch (error) {
    console.error("Export inventory error:", error);
    return { success: false, error: "Failed to export inventory" };
  }
}

export async function exportCustomers(): Promise<ExportResult> {
  const session = await requireRole(["ADMIN", "SALES_REP"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const customers = await db.user.findMany({
      where: { role: "CUSTOMER" },
      include: { customerTags: true },
      orderBy: { createdAt: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Customers");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Email", key: "email", width: 30 },
      { header: "Company", key: "company", width: 25 },
      { header: "B2B Status", key: "b2bStatus", width: 15 },
      { header: "Tags", key: "tags", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Country", key: "country", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    for (const customer of customers) {
      const tags = customer.customerTags.map((t) => t.name).join(", ");

      worksheet.addRow({
        name: customer.name || "",
        email: customer.email || "",
        company: customer.companyName || "",
        b2bStatus: customer.b2bStatus,
        tags: tags || "-",
        phone: customer.phone || "",
        country: customer.registrationCountry || "",
        createdAt: customer.createdAt
          .toISOString()
          .replace("T", " ")
          .slice(0, 19),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const date = new Date().toISOString().split("T")[0];

    return {
      success: true,
      data: base64,
      filename: `customers_export_${date}.xlsx`,
    };
  } catch (error) {
    console.error("Export customers error:", error);
    return { success: false, error: "Failed to export customers" };
  }
}

export async function exportSuppliers(): Promise<ExportResult> {
  const session = await requireRole(["ADMIN", "WAREHOUSE_MANAGER"]);
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const suppliers = await db.supplier.findMany({
      orderBy: { name: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Suppliers");

    worksheet.columns = [
      { header: "Name", key: "name", width: 25 },
      { header: "Code", key: "code", width: 15 },
      { header: "Email", key: "email", width: 30 },
      { header: "Phone", key: "phone", width: 20 },
      { header: "Country", key: "country", width: 15 },
      { header: "Created At", key: "createdAt", width: 20 },
    ];

    for (const supplier of suppliers) {
      const contact = supplier.contact as Record<string, string> | null;

      worksheet.addRow({
        name: supplier.name,
        code: supplier.code,
        email: contact?.email || "",
        phone: contact?.phone || "",
        country: (supplier.address as Record<string, string> | null)?.country || "",
        createdAt: supplier.createdAt
          .toISOString()
          .replace("T", " ")
          .slice(0, 19),
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const date = new Date().toISOString().split("T")[0];

    return {
      success: true,
      data: base64,
      filename: `suppliers_export_${date}.xlsx`,
    };
  } catch (error) {
    console.error("Export suppliers error:", error);
    return { success: false, error: "Failed to export suppliers" };
  }
}

export async function importProducts(
  formData: FormData
): Promise<ImportResult> {
  const session = await requireRole(["ADMIN"]);
  if (!session) {
    return { success: false, count: 0, errors: ["Unauthorized"] };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { success: false, count: 0, errors: ["No file uploaded"] };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // ExcelJS Buffer compatibility (Node 22+): Buffer.from(arrayBuffer) returns Buffer<ArrayBufferLike>
    // which is not assignable to ExcelJS's Buffer param without cast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Node 22+ Buffer<ArrayBufferLike> compat
    await workbook.xlsx.load(buffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
      return { success: false, count: 0, errors: ["Invalid Excel file"] };
    }

    const errors: string[] = [];
    let successCount = 0;

    // Pre-fetch caches to minimize DB calls
    const categories = await db.category.findMany();
    const suppliers = await db.supplier.findMany();
    const existingProducts = await db.product.findMany({
      select: { id: true, slug: true },
    });
    const existingVariants = await db.productVariant.findMany({
      select: { id: true, sku: true },
    });

    // Maps for quick lookup
    const categoryMap = new Map(
      categories.map((c) => {
        const content = c.content as Record<string, Record<string, string>> | null;
        return [(content?.es?.name || content?.en?.name || c.slug).toLowerCase(), c.id];
      })
    );
    const supplierMap = new Map(
      suppliers.map((s) => [s.name.toLowerCase(), s.id])
    );
    const productSlugMap = new Map(existingProducts.map((p) => [p.slug, p.id]));
    const variantSkuMap = new Map(existingVariants.map((v) => [v.sku, v.id]));

    // Iterate rows (skip header)
    // We can't use forEach with async nicely, so use normal loop
    // worksheet.eachRow starts from 1. Header is 1. Data starts 2.
    const rows: Array<{
      rowNumber: number;
      handle: string;
      name: string;
      sku: string;
      price: number;
      stock: number;
      categoryName: string;
      supplierName: string;
      isActive: boolean;
    }> = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      // Assuming columns order: Handle, Name, SKU, Price, Stock, Category, Supplier, Status
      // Or safer: use key-based access if we trust the export format.
      // But user might upload any format. Let's try to read by index for simplicity or column key if available.
      // For robustness, let's assume the user uses our template.

      const handle = row.getCell(1).text?.trim();
      const name = row.getCell(2).text?.trim();
      const sku = row.getCell(3).text?.trim();
      const price = Number(row.getCell(4).value);
      const stock = Number(row.getCell(5).value);
      const categoryName = row.getCell(6).text?.trim();
      const supplierName = row.getCell(7).text?.trim();
      const statusStr = row.getCell(8).text?.trim();
      const isActive = statusStr?.toLowerCase() === "active";

      rows.push({
        rowNumber,
        handle,
        name,
        sku,
        price,
        stock,
        categoryName,
        supplierName,
        isActive,
      });
    });

    for (const row of rows) {
      const {
        rowNumber,
        handle,
        name,
        sku,
        price,
        stock,
        categoryName,
        supplierName,
        isActive,
      } = row;

      if (!sku) {
        errors.push(`Row ${rowNumber}: SKU is missing`);
        continue;
      }

      if (!handle && !name) {
        errors.push(`Row ${rowNumber}: Handle and Name are both missing`);
        continue;
      }

      if (isNaN(price)) {
        errors.push(`Row ${rowNumber}: Invalid price`);
        continue;
      }

      try {
        // 1. Resolve Category
        let categoryId = categoryName
          ? categoryMap.get(categoryName.toLowerCase())
          : null;
        if (categoryName && !categoryId) {
          // Create new category
          const newCat = await db.category.create({
            data: {
              slug:
                categoryName.toLowerCase().replace(/\s+/g, "-") +
                "-" +
                Date.now(), // Simple slug gen
              content: {
                en: { name: categoryName },
                es: { name: categoryName },
              },
            },
          });
          categoryId = newCat.id;
          categoryMap.set(categoryName.toLowerCase(), categoryId);
        }

        // 2. Resolve Supplier
        let supplierId = supplierName
          ? supplierMap.get(supplierName.toLowerCase())
          : null;
        if (supplierName && !supplierId) {
          // Create new supplier
          const newSup = await db.supplier.create({
            data: {
              name: supplierName,
              code: `SUP-${Date.now()}`, // Auto-generated code
              contact: { email: `temp-${Date.now()}@example.com`, contactPerson: "System Import" },
            },
          });
          supplierId = newSup.id;
          supplierMap.set(supplierName.toLowerCase(), supplierId);
        }

        // 3. Check if Variant exists
        if (variantSkuMap.has(sku)) {
          // UPDATE Existing Variant
          const variantId = variantSkuMap.get(sku)!;
          await db.productVariant.update({
            where: { id: variantId },
            data: {
              price: price,
              physicalStock: stock,
            },
          });

          // Optionally update Product status if provided?
          // Let's keep it simple.
        } else {
          // CREATE New Variant
          // Check if Product exists (by Handle/Slug)
          let productId = handle ? productSlugMap.get(handle) : null;

          if (!productId && handle) {
            // Create New Product
            if (!categoryId && categories.length > 0)
              categoryId = categories[0].id;
            if (!supplierId && suppliers.length > 0)
              supplierId = suppliers[0].id;

            if (!categoryId || !supplierId) {
              // Try to fetch defaults again if empty?
              // If really empty DB, create default ones?
              // For now, fail.
              if (!categoryId) {
                const defaultCat = await db.category.create({
                  data: {
                    slug: "uncategorized",
                    content: { en: { name: "Uncategorized" }, es: { name: "Sin categoría" } },
                  },
                });
                categoryId = defaultCat.id;
                // Update cache
                categoryMap.set("uncategorized", categoryId);
                categories.push(defaultCat);
              }
              if (!supplierId) {
                const defaultSup = await db.supplier.create({
                  data: {
                    name: "Default Supplier",
                    code: `SUP-DEFAULT-${Date.now()}`,
                    contact: { email: "default@example.com", contactPerson: "Admin" },
                  },
                });
                supplierId = defaultSup.id;
                supplierMap.set("default supplier", supplierId);
                suppliers.push(defaultSup);
              }
            }

            const newProduct = await db.product.create({
              data: {
                slug: handle,
                sku: handle, // Use handle as Base SKU
                categoryId,
                supplierId, // Deprecated field, but needed for relation or use productSuppliers?
                // Schema says supplierId is String? and has relation.
                // It also has productSuppliers. Let's set supplierId for simplicity as it's optional but useful.
                isActive: isActive,
                content: {
                  en: { name: name || handle, description: "" },
                  es: { name: name || handle, description: "" },
                },
              },
            });
            productId = newProduct.id;
            productSlugMap.set(handle, productId);
          }

          if (productId) {
            // Add Variant to Product
            await db.productVariant.create({
              data: {
                productId,
                sku,
                price,
                physicalStock: stock,
                specs: [], // Empty specs
              },
            });
            // Update cache
            // We don't need the ID for next rows unless we update it again, but we assume unique SKU per file.
          } else {
            errors.push(
              `Row ${rowNumber}: Product handle '${handle}' not found and could not be created`
            );
            continue;
          }
        }
        successCount++;
      } catch (err: unknown) {
        errors.push(`Row ${rowNumber}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    revalidatePath("/admin/products");
    return { success: true, count: successCount, errors };
  } catch (error) {
    console.error("Import error:", error);
    return { success: false, count: 0, errors: ["Failed to process file"] };
  }
}
