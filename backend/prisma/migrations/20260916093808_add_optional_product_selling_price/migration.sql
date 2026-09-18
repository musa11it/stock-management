-- Re-add selling price as an OPTIONAL field: most ingredients aren't sold directly, but a
-- few (bottled drinks, etc.) are. Nullable - unset means "not sold directly".

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "sellingPrice" DECIMAL(14,2);
