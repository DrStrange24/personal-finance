-- Remove workbook import staging feature schema objects.
DROP INDEX IF EXISTS "FinanceTransaction_importBatchId_postedAt_idx";

ALTER TABLE "FinanceTransaction"
    DROP CONSTRAINT IF EXISTS "FinanceTransaction_importBatchId_fkey";

ALTER TABLE "FinanceTransaction"
    DROP COLUMN IF EXISTS "importBatchId";

DROP TABLE IF EXISTS "ImportRow";
DROP TABLE IF EXISTS "ImportBatch";

DROP TYPE IF EXISTS "ImportRowStatus";
DROP TYPE IF EXISTS "ImportBatchStatus";
DROP TYPE IF EXISTS "ImportMode";
