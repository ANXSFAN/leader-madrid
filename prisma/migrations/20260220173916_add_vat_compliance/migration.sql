-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "buyerVatNumber" TEXT,
ADD COLUMN     "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00;

-- CreateTable
CREATE TABLE "country_vat_configs" (
    "id" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "standardRate" DECIMAL(5,2) NOT NULL,
    "reducedRate" DECIMAL(5,2),
    "isEU" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "country_vat_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "country_vat_configs_countryCode_key" ON "country_vat_configs"("countryCode");
