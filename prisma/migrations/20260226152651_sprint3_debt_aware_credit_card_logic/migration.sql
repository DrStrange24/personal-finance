-- Sprint 3: Debt-Aware Credit Card Logic (WS3)
-- Ordered migration:
-- 1) enum + nullable columns
-- 2) backfill envelope system typing/linkage
-- 3) guard checks
-- 4) constraints, indexes, and partial uniqueness

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BudgetEnvelopeSystemType') THEN
        CREATE TYPE "BudgetEnvelopeSystemType" AS ENUM (
            'TRANSFER',
            'CREDIT_CARD_PAYMENT',
            'LOAN_INFLOW',
            'LOAN_PAYMENT'
        );
    END IF;
END
$$;

ALTER TABLE "BudgetEnvelope"
    ADD COLUMN IF NOT EXISTS "systemType" "BudgetEnvelopeSystemType",
    ADD COLUMN IF NOT EXISTS "linkedWalletAccountId" TEXT,
    ADD COLUMN IF NOT EXISTS "linkedCreditAccountId" TEXT;

ALTER TABLE "FinanceTransaction"
    ADD COLUMN IF NOT EXISTS "ccPaymentEnvelopeId" TEXT;

-- Backfill known system envelope typings.
UPDATE "BudgetEnvelope"
SET "systemType" = 'TRANSFER'::"BudgetEnvelopeSystemType"
WHERE "isSystem" = true
  AND "name" = 'System: Transfer'
  AND ("systemType" IS NULL OR "systemType" <> 'TRANSFER'::"BudgetEnvelopeSystemType");

UPDATE "BudgetEnvelope"
SET "systemType" = 'LOAN_INFLOW'::"BudgetEnvelopeSystemType"
WHERE "isSystem" = true
  AND "name" = 'System: Loan Inflow'
  AND ("systemType" IS NULL OR "systemType" <> 'LOAN_INFLOW'::"BudgetEnvelopeSystemType");

UPDATE "BudgetEnvelope"
SET "systemType" = 'LOAN_PAYMENT'::"BudgetEnvelopeSystemType"
WHERE "isSystem" = true
  AND "name" = 'System: Loan Payment'
  AND ("systemType" IS NULL OR "systemType" <> 'LOAN_PAYMENT'::"BudgetEnvelopeSystemType");

UPDATE "BudgetEnvelope"
SET "systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
WHERE "isSystem" = true
  AND (
        "name" = 'System: Credit Payment'
        OR "name" LIKE 'System: CC Payment - %'
      )
  AND (
        "systemType" IS NULL
        OR "systemType" <> 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
      );

-- Backfill per-card linkage by deterministic per-card naming pattern.
UPDATE "BudgetEnvelope" be
SET "linkedWalletAccountId" = wa."id"
FROM "WalletAccount" wa
WHERE be."systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
  AND be."linkedWalletAccountId" IS NULL
  AND be."userId" = wa."userId"
  AND be."entityId" = wa."entityId"
  AND wa."type" = 'CREDIT_CARD'::"WalletAccountType"
  AND be."name" = CONCAT('System: CC Payment - ', wa."name");

UPDATE "BudgetEnvelope" be
SET "linkedCreditAccountId" = ca."id"
FROM "CreditAccount" ca
WHERE be."systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
  AND be."linkedCreditAccountId" IS NULL
  AND be."userId" = ca."userId"
  AND be."entityId" = ca."entityId"
  AND be."name" = CONCAT('System: CC Payment - ', ca."name");

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "BudgetEnvelope"
        WHERE "systemType" IS NOT NULL
          AND "isSystem" = false
    ) THEN
        RAISE EXCEPTION 'Sprint 3 guard failed: systemType is set on a non-system BudgetEnvelope.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "BudgetEnvelope"
        WHERE "systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
          AND "isArchived" = false
          AND "linkedWalletAccountId" IS NOT NULL
        GROUP BY "entityId", "linkedWalletAccountId"
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Sprint 3 guard failed: duplicate active-linked CC payment envelopes found by wallet.';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'BudgetEnvelope_system_type_requires_system_chk'
    ) THEN
        ALTER TABLE "BudgetEnvelope"
            ADD CONSTRAINT "BudgetEnvelope_system_type_requires_system_chk"
            CHECK (
                "systemType" IS NULL
                OR "isSystem" = true
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'BudgetEnvelope_linkedWalletAccountId_fkey'
    ) THEN
        ALTER TABLE "BudgetEnvelope"
            ADD CONSTRAINT "BudgetEnvelope_linkedWalletAccountId_fkey"
            FOREIGN KEY ("linkedWalletAccountId")
            REFERENCES "WalletAccount"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'BudgetEnvelope_linkedCreditAccountId_fkey'
    ) THEN
        ALTER TABLE "BudgetEnvelope"
            ADD CONSTRAINT "BudgetEnvelope_linkedCreditAccountId_fkey"
            FOREIGN KEY ("linkedCreditAccountId")
            REFERENCES "CreditAccount"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'FinanceTransaction_ccPaymentEnvelopeId_fkey'
    ) THEN
        ALTER TABLE "FinanceTransaction"
            ADD CONSTRAINT "FinanceTransaction_ccPaymentEnvelopeId_fkey"
            FOREIGN KEY ("ccPaymentEnvelopeId")
            REFERENCES "BudgetEnvelope"("id")
            ON DELETE SET NULL
            ON UPDATE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_systemType_isArchived_idx"
    ON "BudgetEnvelope"("entityId", "systemType", "isArchived");

CREATE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_systemType_linkedWalletAccountId_idx"
    ON "BudgetEnvelope"("entityId", "systemType", "linkedWalletAccountId");

CREATE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_systemType_linkedCreditAccountId_idx"
    ON "BudgetEnvelope"("entityId", "systemType", "linkedCreditAccountId");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_ccPaymentEnvelopeId_postedAt_idx"
    ON "FinanceTransaction"("entityId", "ccPaymentEnvelopeId", "postedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_linkedWallet_cc_payment_active_key"
    ON "BudgetEnvelope"("entityId", "linkedWalletAccountId")
    WHERE "isSystem" = true
      AND "isArchived" = false
      AND "systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
      AND "linkedWalletAccountId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_linkedCredit_cc_payment_active_key"
    ON "BudgetEnvelope"("entityId", "linkedCreditAccountId")
    WHERE "isSystem" = true
      AND "isArchived" = false
      AND "systemType" = 'CREDIT_CARD_PAYMENT'::"BudgetEnvelopeSystemType"
      AND "linkedCreditAccountId" IS NOT NULL;
