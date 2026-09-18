-- Track who accepted/confirmed an order (moved it to COMPLETED) and when, separately from who
-- created it, so order accountability history is available directly on the Sale row.

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: a completed POS sale is, by construction, created and completed in the same
-- action by the same person - so it was self-confirmed at creation. This is a factual
-- reconstruction, not a guess. Completed ONLINE orders from before this feature existed have
-- no recoverable "who confirmed it" history, so they're deliberately left null rather than
-- fabricated.
UPDATE "sales" SET "confirmedById" = "createdById", "confirmedAt" = "createdAt"
WHERE "source" = 'POS' AND "status" = 'COMPLETED';
