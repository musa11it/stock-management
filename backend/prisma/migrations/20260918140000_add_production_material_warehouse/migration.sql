-- AlterTable
ALTER TABLE "production_materials" ADD COLUMN     "warehouseId" TEXT;

-- CreateIndex
CREATE INDEX "production_materials_warehouseId_idx" ON "production_materials"("warehouseId");

-- AddForeignKey
ALTER TABLE "production_materials" ADD CONSTRAINT "production_materials_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
