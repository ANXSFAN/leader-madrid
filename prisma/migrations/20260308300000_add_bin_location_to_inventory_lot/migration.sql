-- AlterTable
ALTER TABLE "inventory_lots" ADD COLUMN "binLocationId" TEXT;

-- CreateIndex
CREATE INDEX "inventory_lots_binLocationId_idx" ON "inventory_lots"("binLocationId");

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_binLocationId_fkey" FOREIGN KEY ("binLocationId") REFERENCES "bin_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
