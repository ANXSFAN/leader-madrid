-- CreateEnum
CREATE TYPE "CustomsDeclarationType" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "CustomsStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'INSPECTING', 'CLEARED', 'HELD', 'RELEASED');

-- CreateEnum
CREATE TYPE "CustomsShippingMethod" AS ENUM ('SEA', 'AIR', 'ROAD', 'RAIL');

-- CreateEnum
CREATE TYPE "FederationNodeType" AS ENUM ('UPSTREAM', 'DOWNSTREAM');

-- CreateEnum
CREATE TYPE "FederationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SYNCED', 'MODIFIED', 'CONFLICT', 'DISABLED');

-- CreateEnum
CREATE TYPE "FederationOrderStatus" AS ENUM ('PENDING', 'SENT', 'ACKNOWLEDGED', 'PROCESSING', 'PARTIALLY_SHIPPED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DRAFT', 'SENT', 'UNDER_REVIEW', 'AGREED', 'DISPUTED', 'SETTLED');

-- AlterTable
ALTER TABLE "attribute_definitions" ADD COLUMN     "isFilterable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isHighlight" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "buyerCountry" TEXT,
ADD COLUMN     "buyerSnapshot" JSONB,
ADD COLUMN     "buyerVatNumber" TEXT,
ADD COLUMN     "integrityHash" TEXT,
ADD COLUMN     "isExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isReverseCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lineItemsSnapshot" JSONB,
ADD COLUMN     "sellerSnapshot" JSONB,
ADD COLUMN     "vatLabel" TEXT,
ADD COLUMN     "vatLegalNote" TEXT,
ADD COLUMN     "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 21.00;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "federationSource" TEXT,
ADD COLUMN     "hsCode" TEXT,
ADD COLUMN     "upstreamProductId" TEXT;

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN     "customsClearedAt" TIMESTAMP(3),
ADD COLUMN     "customsDeclarationNumber" TEXT,
ADD COLUMN     "customsNotes" TEXT,
ADD COLUMN     "customsServiceFee" DECIMAL(10,2),
ADD COLUMN     "dutyAmount" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "invoice_counters" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "year" INTEGER NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("id","year")
);

-- CreateTable
CREATE TABLE "newsletter_subscriptions" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declarations" (
    "id" TEXT NOT NULL,
    "declarationNumber" TEXT NOT NULL,
    "type" "CustomsDeclarationType" NOT NULL,
    "status" "CustomsStatus" NOT NULL DEFAULT 'DRAFT',
    "purchaseOrderId" TEXT,
    "salesOrderId" TEXT,
    "customsOffice" TEXT,
    "entryPort" TEXT,
    "countryOfOrigin" TEXT,
    "destinationCountry" TEXT,
    "declaredValue" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dutyRate" DECIMAL(5,2),
    "dutyAmount" DECIMAL(10,2),
    "vatAmount" DECIMAL(10,2),
    "otherCharges" DECIMAL(10,2),
    "totalCost" DECIMAL(12,2),
    "trackingNumber" TEXT,
    "shippingMethod" "CustomsShippingMethod",
    "estimatedArrival" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "brokerName" TEXT,
    "brokerContact" TEXT,
    "documents" JSONB,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customs_declarations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_declaration_items" (
    "id" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT,
    "hsCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "totalValue" DECIMAL(12,2) NOT NULL,
    "weight" DECIMAL(10,3),
    "countryOfOrigin" TEXT,

    CONSTRAINT "customs_declaration_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_nodes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "FederationNodeType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "apiSecret" TEXT NOT NULL,
    "inboundKey" TEXT NOT NULL,
    "status" "FederationStatus" NOT NULL DEFAULT 'PENDING',
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "creditLimit" DECIMAL(12,2),
    "supplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federation_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_sync_logs" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB,
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supply_channels" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isSubscribed" BOOLEAN NOT NULL DEFAULT false,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "syncPricing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_products" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "upstreamProductId" TEXT NOT NULL,
    "upstreamSku" TEXT NOT NULL,
    "localProductId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "syncHash" TEXT,
    "syncStatus" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "priceMarkupPercent" DECIMAL(5,2),
    "priceOverride" DECIMAL(10,2),
    "contentOverride" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_orders" (
    "id" TEXT NOT NULL,
    "localOrderId" TEXT,
    "localPOId" TEXT,
    "remoteOrderId" TEXT,
    "remoteOrderNumber" TEXT,
    "nodeId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" "FederationOrderStatus" NOT NULL DEFAULT 'PENDING',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federation_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_order_items" (
    "id" TEXT NOT NULL,
    "federationOrderId" TEXT NOT NULL,
    "upstreamVariantId" TEXT NOT NULL,
    "localVariantId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "sku" TEXT,
    "name" TEXT,

    CONSTRAINT "federation_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_order_status_history" (
    "id" TEXT NOT NULL,
    "federationOrderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "federation_order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_settlements" (
    "id" TEXT NOT NULL,
    "settlementNumber" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'DRAFT',
    "totalOrders" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "localConfirmedAt" TIMESTAMP(3),
    "remoteConfirmedAt" TIMESTAMP(3),
    "localConfirmedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "federation_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "federation_settlement_lines" (
    "id" TEXT NOT NULL,
    "settlementId" TEXT NOT NULL,
    "federationOrderId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "federation_settlement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customs_declarations_declarationNumber_key" ON "customs_declarations"("declarationNumber");

-- CreateIndex
CREATE INDEX "customs_declarations_status_idx" ON "customs_declarations"("status");

-- CreateIndex
CREATE INDEX "customs_declarations_type_idx" ON "customs_declarations"("type");

-- CreateIndex
CREATE INDEX "customs_declarations_purchaseOrderId_idx" ON "customs_declarations"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "customs_declarations_salesOrderId_idx" ON "customs_declarations"("salesOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "federation_nodes_code_key" ON "federation_nodes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "federation_nodes_inboundKey_key" ON "federation_nodes"("inboundKey");

-- CreateIndex
CREATE UNIQUE INDEX "federation_nodes_supplierId_key" ON "federation_nodes"("supplierId");

-- CreateIndex
CREATE INDEX "federation_sync_logs_nodeId_idx" ON "federation_sync_logs"("nodeId");

-- CreateIndex
CREATE INDEX "federation_sync_logs_entityType_entityId_idx" ON "federation_sync_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "federation_sync_logs_createdAt_idx" ON "federation_sync_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "supply_channels_nodeId_name_key" ON "supply_channels"("nodeId", "name");

-- CreateIndex
CREATE INDEX "channel_products_localProductId_idx" ON "channel_products"("localProductId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_products_channelId_upstreamProductId_key" ON "channel_products"("channelId", "upstreamProductId");

-- CreateIndex
CREATE INDEX "federation_orders_nodeId_idx" ON "federation_orders"("nodeId");

-- CreateIndex
CREATE INDEX "federation_orders_localOrderId_idx" ON "federation_orders"("localOrderId");

-- CreateIndex
CREATE INDEX "federation_orders_localPOId_idx" ON "federation_orders"("localPOId");

-- CreateIndex
CREATE INDEX "federation_orders_remoteOrderId_idx" ON "federation_orders"("remoteOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "federation_settlements_settlementNumber_key" ON "federation_settlements"("settlementNumber");

-- CreateIndex
CREATE INDEX "federation_settlements_nodeId_idx" ON "federation_settlements"("nodeId");

-- CreateIndex
CREATE INDEX "federation_settlements_status_idx" ON "federation_settlements"("status");

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declarations" ADD CONSTRAINT "customs_declarations_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_declaration_items" ADD CONSTRAINT "customs_declaration_items_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "customs_declarations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_nodes" ADD CONSTRAINT "federation_nodes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_sync_logs" ADD CONSTRAINT "federation_sync_logs_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "federation_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supply_channels" ADD CONSTRAINT "supply_channels_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "federation_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_products" ADD CONSTRAINT "channel_products_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "supply_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_products" ADD CONSTRAINT "channel_products_localProductId_fkey" FOREIGN KEY ("localProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_orders" ADD CONSTRAINT "federation_orders_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "federation_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_order_items" ADD CONSTRAINT "federation_order_items_federationOrderId_fkey" FOREIGN KEY ("federationOrderId") REFERENCES "federation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_order_status_history" ADD CONSTRAINT "federation_order_status_history_federationOrderId_fkey" FOREIGN KEY ("federationOrderId") REFERENCES "federation_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_settlements" ADD CONSTRAINT "federation_settlements_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "federation_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "federation_settlement_lines" ADD CONSTRAINT "federation_settlement_lines_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "federation_settlements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
