-- AlterTable
ALTER TABLE "price_lists" ADD COLUMN     "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "levelCode" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "customerLevel" TEXT;
