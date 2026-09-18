-- Production module: raw materials -> finished product. Purely additive - two new enum
-- values on existing enums, plus two new tables. No existing data touched.

-- AlterEnum
ALTER TYPE "ReferenceType" ADD VALUE 'PRODUCTION';

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_CONSUME';
ALTER TYPE "StockMovementType" ADD VALUE 'PRODUCTION_YIELD';

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "productions" (
    "id" TEXT NOT NULL,
    "productionNumber" TEXT NOT NULL,
    "finishedProductId" TEXT NOT NULL,
    "plannedQuantity" DECIMAL(14,3) NOT NULL,
    "actualQuantity" DECIMAL(14,3),
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "ProductionStatus" NOT NULL DEFAULT 'DRAFT',
    "unitCost" DECIMAL(14,4),
    "totalCost" DECIMAL(14,2),
    "batchNumber" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_materials" (
    "id" TEXT NOT NULL,
    "productionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "production_materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productions_productionNumber_key" ON "productions"("productionNumber");

-- CreateIndex
CREATE INDEX "productions_finishedProductId_idx" ON "productions"("finishedProductId");

-- CreateIndex
CREATE INDEX "productions_status_idx" ON "productions"("status");

-- CreateIndex
CREATE INDEX "productions_createdAt_idx" ON "productions"("createdAt");

-- CreateIndex
CREATE INDEX "production_materials_productionId_idx" ON "production_materials"("productionId");

-- CreateIndex
CREATE INDEX "production_materials_productId_idx" ON "production_materials"("productId");

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "productions" ADD CONSTRAINT "productions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_productionId_fkey" FOREIGN KEY ("productionId") REFERENCES "productions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
