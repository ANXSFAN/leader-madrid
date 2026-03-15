-- AlterTable
ALTER TABLE "products" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "attribute_definitions" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
