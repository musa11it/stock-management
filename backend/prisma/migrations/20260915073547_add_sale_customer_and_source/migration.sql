-- CreateEnum
CREATE TYPE "SaleSource" AS ENUM ('POS', 'ONLINE');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "source" "SaleSource" NOT NULL DEFAULT 'POS';

-- CreateIndex
CREATE INDEX "sales_customerId_idx" ON "sales"("customerId");

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
