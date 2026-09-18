-- AlterTable
ALTER TABLE "menu_items" ADD COLUMN     "linkedProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_linkedProductId_key" ON "menu_items"("linkedProductId");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_linkedProductId_fkey" FOREIGN KEY ("linkedProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
