-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "shipping" DECIMAL(10,2),
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "tax" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN     "shipping" DECIMAL(10,2),
ADD COLUMN     "subtotal" DECIMAL(10,2),
ADD COLUMN     "tax" DECIMAL(10,2);
