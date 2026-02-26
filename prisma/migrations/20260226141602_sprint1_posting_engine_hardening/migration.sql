-- Sprint 1: Posting Engine Hardening
-- Ordered migration:
-- 1) create enum/type prerequisites
-- 2) add nullable columns
-- 3) backfill data
-- 4) enforce NOT NULL and constraints
-- 5) add indexes and foreign keys

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdjustmentReasonCode') THEN
        CREATE TYPE "AdjustmentReasonCode" AS ENUM (
            'OPENING_BALANCE',
            'BALANCE_CORRECTION',
            'IMPORT_BOOTSTRAP',
            'SYSTEM_RECONCILIATION',
            'MANUAL_FIX'
        );
    END IF;
END
$$;

ALTER TABLE "FinanceTransaction"
    ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
    ADD COLUMN IF NOT EXISTS "adjustmentReasonCode" "AdjustmentReasonCode",
    ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT,
    ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "voidedByUserId" TEXT;

UPDATE "FinanceTransaction"
SET "actorUserId" = "userId"
WHERE "actorUserId" IS NULL;

ALTER TABLE "FinanceTransaction"
    ALTER COLUMN "actorUserId" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FinanceTransaction_reversedTransactionId_fkey'
    ) THEN
        ALTER TABLE "FinanceTransaction"
            ADD CONSTRAINT "FinanceTransaction_reversedTransactionId_fkey"
            FOREIGN KEY ("reversedTransactionId")
            REFERENCES "FinanceTransaction"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "FinanceTransaction_reversedTransactionId_key"
    ON "FinanceTransaction"("reversedTransactionId");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_userId_isReversal_voidedAt_postedAt_idx"
    ON "FinanceTransaction"("userId", "isReversal", "voidedAt", "postedAt");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_isReversal_voidedAt_postedAt_idx"
    ON "FinanceTransaction"("entityId", "isReversal", "voidedAt", "postedAt");

-- Backfill legacy ADJUSTMENT rows before enforcing the check constraint.
UPDATE "FinanceTransaction"
SET
    "adjustmentReasonCode" = COALESCE("adjustmentReasonCode", 'MANUAL_FIX'::"AdjustmentReasonCode"),
    "remarks" = CASE
        WHEN "remarks" IS NULL OR length(btrim("remarks")) = 0
            THEN 'Backfilled by Sprint 1 migration: legacy adjustment entry.'
        ELSE "remarks"
    END
WHERE "kind" = 'ADJUSTMENT';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FinanceTransaction_adjustment_reason_required_chk'
    ) THEN
        ALTER TABLE "FinanceTransaction"
            ADD CONSTRAINT "FinanceTransaction_adjustment_reason_required_chk"
            CHECK (
                "kind" <> 'ADJUSTMENT'
                OR (
                    "adjustmentReasonCode" IS NOT NULL
                    AND "remarks" IS NOT NULL
                    AND length(btrim("remarks")) > 0
                )
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FinanceTransaction_reversal_link_chk'
    ) THEN
        ALTER TABLE "FinanceTransaction"
            ADD CONSTRAINT "FinanceTransaction_reversal_link_chk"
            CHECK (
                ("isReversal" = true AND "reversedTransactionId" IS NOT NULL)
                OR ("isReversal" = false AND "reversedTransactionId" IS NULL)
            );
    END IF;
END
$$;
