-- AlterTable
ALTER TABLE "order_items" ADD COLUMN "image" TEXT;

-- AlterTable
ALTER TABLE "sales_order_items" ADD COLUMN "name" TEXT,
ADD COLUMN "sku" TEXT,
ADD COLUMN "image" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_items" ADD COLUMN "name" TEXT,
ADD COLUMN "sku" TEXT;

-- AlterTable
ALTER TABLE "return_items" ADD COLUMN "name" TEXT,
ADD COLUMN "sku" TEXT,
ADD COLUMN "image" TEXT;
