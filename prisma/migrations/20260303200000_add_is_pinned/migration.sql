-- AlterTable
ALTER TABLE "products" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "attribute_definitions" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;
