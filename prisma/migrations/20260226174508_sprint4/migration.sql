-- Sprint 4: Import Reliability & Idempotency (WS4)
-- Ordered migration:
-- 1) enums
-- 2) durable staging tables
-- 3) FinanceTransaction traceability columns
-- 4) constraints and indexes (including idempotency/uniqueness)

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportMode') THEN
        CREATE TYPE "ImportMode" AS ENUM (
            'BALANCE_BOOTSTRAP',
            'FULL_LEDGER'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportBatchStatus') THEN
        CREATE TYPE "ImportBatchStatus" AS ENUM (
            'STAGED',
            'COMMITTING',
            'COMMITTED',
            'FAILED'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ImportRowStatus') THEN
        CREATE TYPE "ImportRowStatus" AS ENUM (
            'STAGED',
            'COMMITTED',
            'FAILED'
        );
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceFileHash" TEXT NOT NULL,
    "importMode" "ImportMode" NOT NULL,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'STAGED',
    "errorMessage" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "rowHash" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'STAGED',
    "errorMessage" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FinanceTransaction"
    ADD COLUMN IF NOT EXISTS "externalId" TEXT,
    ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ImportBatch_userId_fkey'
    ) THEN
        ALTER TABLE "ImportBatch"
            ADD CONSTRAINT "ImportBatch_userId_fkey"
            FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ImportBatch_entityId_fkey'
    ) THEN
        ALTER TABLE "ImportBatch"
            ADD CONSTRAINT "ImportBatch_entityId_fkey"
            FOREIGN KEY ("entityId")
            REFERENCES "FinanceEntity"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ImportRow_batchId_fkey'
    ) THEN
        ALTER TABLE "ImportRow"
            ADD CONSTRAINT "ImportRow_batchId_fkey"
            FOREIGN KEY ("batchId")
            REFERENCES "ImportBatch"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FinanceTransaction_importBatchId_fkey'
    ) THEN
        ALTER TABLE "FinanceTransaction"
            ADD CONSTRAINT "FinanceTransaction_importBatchId_fkey"
            FOREIGN KEY ("importBatchId")
            REFERENCES "ImportBatch"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "ImportRow_idempotencyKey_key"
    ON "ImportRow"("idempotencyKey");

CREATE INDEX IF NOT EXISTS "ImportBatch_userId_entityId_createdAt_idx"
    ON "ImportBatch"("userId", "entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "ImportBatch_entityId_status_createdAt_idx"
    ON "ImportBatch"("entityId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ImportBatch_userId_sourceFileHash_createdAt_idx"
    ON "ImportBatch"("userId", "sourceFileHash", "createdAt");

CREATE INDEX IF NOT EXISTS "ImportRow_batchId_status_rowIndex_idx"
    ON "ImportRow"("batchId", "status", "rowIndex");

CREATE INDEX IF NOT EXISTS "ImportRow_sheetName_rowIndex_idx"
    ON "ImportRow"("sheetName", "rowIndex");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_externalId_idx"
    ON "FinanceTransaction"("entityId", "externalId");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_importBatchId_postedAt_idx"
    ON "FinanceTransaction"("importBatchId", "postedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceTransaction_entity_external_id_key"
    ON "FinanceTransaction"("entityId", "externalId")
    WHERE "entityId" IS NOT NULL
      AND "externalId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FinanceTransaction_entity_external_id_key" ON "FinanceTransaction"("entityId", "externalId");
