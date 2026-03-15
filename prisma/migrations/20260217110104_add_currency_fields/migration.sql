-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('SIMPLE', 'BUNDLE');

-- AlterTable
ALTER TABLE "attribute_options" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "type" "ProductType" NOT NULL DEFAULT 'SIMPLE';

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'EUR',
ADD COLUMN     "exchangeRate" DECIMAL(10,4) NOT NULL DEFAULT 1.0;
