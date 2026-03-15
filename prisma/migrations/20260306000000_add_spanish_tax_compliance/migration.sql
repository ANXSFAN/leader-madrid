-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('STANDARD', 'RECTIFICATIVA', 'SIMPLIFICADA');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "invoiceType" "InvoiceType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "originalInvoiceId" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "rectificationReason" TEXT,
ADD COLUMN     "vatBreakdown" JSONB,
ADD COLUMN     "verifactuId" TEXT,
ADD COLUMN     "verifactuQrData" TEXT;

-- CreateIndex
CREATE INDEX "invoices_originalInvoiceId_idx" ON "invoices"("originalInvoiceId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
