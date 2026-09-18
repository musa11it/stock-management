-- Introduce per-batch expiry tracking: the same product/warehouse can hold multiple
-- receipts with different expiry dates, which the old single expiryDate/batchNumber
-- columns on `inventories` could not represent.

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitCost" DECIMAL(14,4) NOT NULL,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiryDate" TIMESTAMP(3),
    "batchNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_batches_productId_warehouseId_quantity_idx" ON "inventory_batches"("productId", "warehouseId", "quantity");

-- CreateIndex
CREATE INDEX "inventory_batches_expiryDate_idx" ON "inventory_batches"("expiryDate");

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing inventory row with stock on hand becomes its own batch, carrying
-- forward whatever expiryDate/batchNumber it already had, so no expiry data is lost.
INSERT INTO "inventory_batches" ("id", "productId", "warehouseId", "quantity", "unitCost", "receivedDate", "expiryDate", "batchNumber", "createdAt")
SELECT gen_random_uuid(), "productId", "warehouseId", "quantity", "averageCost", "updatedAt", "expiryDate", "batchNumber", "createdAt"
FROM "inventories"
WHERE "quantity" > 0;

-- AlterTable: expiry/batch now live on inventory_batches, not the aggregate row.
ALTER TABLE "inventories" DROP COLUMN "batchNumber",
DROP COLUMN "expiryDate";

-- AlterTable: purchase-item expiry is superseded by the computed Received Date + Shelf Life
-- batch expiry - it was never populated by the UI and would only create a second, conflicting
-- source of truth.
ALTER TABLE "purchase_items" DROP COLUMN "expiryDate";
