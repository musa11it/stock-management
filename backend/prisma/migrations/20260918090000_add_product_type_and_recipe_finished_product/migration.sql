-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('RAW_MATERIAL', 'FINISHED_PRODUCT', 'DIRECT_SALE', 'PACKAGING');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "type" "ProductType";

-- AlterTable
ALTER TABLE "recipes" ADD COLUMN     "finishedProductId" TEXT;

-- CreateIndex
CREATE INDEX "products_type_idx" ON "products"("type");

-- CreateIndex
CREATE UNIQUE INDEX "recipes_finishedProductId_key" ON "recipes"("finishedProductId");

-- AddForeignKey
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_finishedProductId_fkey" FOREIGN KEY ("finishedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
