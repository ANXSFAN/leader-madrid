-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "sales_orders" ADD COLUMN "warehouseId" TEXT;

-- AlterTable
ALTER TABLE "return_requests" ADD COLUMN "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "purchase_orders_warehouseId_idx" ON "purchase_orders"("warehouseId");

-- CreateIndex
CREATE INDEX "sales_orders_warehouseId_idx" ON "sales_orders"("warehouseId");

-- CreateIndex
CREATE INDEX "return_requests_warehouseId_idx" ON "return_requests"("warehouseId");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
