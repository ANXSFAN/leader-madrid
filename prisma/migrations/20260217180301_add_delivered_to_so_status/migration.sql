-- AlterEnum
ALTER TYPE "SOStatus" ADD VALUE 'DELIVERED';

-- CreateTable
CREATE TABLE "global_configs" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_configs_pkey" PRIMARY KEY ("key")
);
