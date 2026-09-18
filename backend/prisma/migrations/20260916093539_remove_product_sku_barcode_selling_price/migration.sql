-- Products are inventory/ingredient items, never sold directly to customers.
-- Remove SKU, barcode, and selling price; `name` becomes the unique business key
-- (the `id` UUID remains the system identifier used throughout the app).

-- DropIndex
DROP INDEX "products_barcode_key";

-- DropIndex
DROP INDEX "products_sku_key";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "barcode",
DROP COLUMN "sellingPrice",
DROP COLUMN "sku";

-- CreateIndex
CREATE UNIQUE INDEX "products_name_key" ON "products"("name");
