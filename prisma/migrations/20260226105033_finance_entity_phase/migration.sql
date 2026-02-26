-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSONAL', 'BUSINESS');

-- AlterTable
ALTER TABLE "BudgetEnvelope" ADD COLUMN     "entityId" TEXT;

-- AlterTable
ALTER TABLE "FinanceTransaction" ADD COLUMN     "entityId" TEXT;

-- AlterTable
ALTER TABLE "IncomeStream" ADD COLUMN     "entityId" TEXT;

-- AlterTable
ALTER TABLE "LoanRecord" ADD COLUMN     "entityId" TEXT;

-- AlterTable
ALTER TABLE "WalletAccount" ADD COLUMN     "entityId" TEXT;

-- CreateTable
CREATE TABLE "FinanceEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceEntity_pkey" PRIMARY KEY ("id")
);

-- Data backfill: create one default PERSONAL entity per user (idempotent by user/name/type).
INSERT INTO "FinanceEntity" ("id", "userId", "name", "type", "createdAt", "updatedAt")
SELECT
    CONCAT('fe_personal_', u."id") AS "id",
    u."id" AS "userId",
    'Personal' AS "name",
    'PERSONAL'::"EntityType" AS "type",
    NOW() AS "createdAt",
    NOW() AS "updatedAt"
FROM "User" u
WHERE NOT EXISTS (
    SELECT 1
    FROM "FinanceEntity" fe
    WHERE fe."userId" = u."id"
      AND fe."name" = 'Personal'
      AND fe."type" = 'PERSONAL'::"EntityType"
);

-- Data transfer: attach legacy financial rows to the user's default PERSONAL entity.
UPDATE "WalletAccount" wa
SET "entityId" = fe."id"
FROM "FinanceEntity" fe
WHERE wa."entityId" IS NULL
  AND fe."userId" = wa."userId"
  AND fe."name" = 'Personal'
  AND fe."type" = 'PERSONAL'::"EntityType";

UPDATE "BudgetEnvelope" be
SET "entityId" = fe."id"
FROM "FinanceEntity" fe
WHERE be."entityId" IS NULL
  AND fe."userId" = be."userId"
  AND fe."name" = 'Personal'
  AND fe."type" = 'PERSONAL'::"EntityType";

UPDATE "LoanRecord" lr
SET "entityId" = fe."id"
FROM "FinanceEntity" fe
WHERE lr."entityId" IS NULL
  AND fe."userId" = lr."userId"
  AND fe."name" = 'Personal'
  AND fe."type" = 'PERSONAL'::"EntityType";

UPDATE "IncomeStream" isr
SET "entityId" = fe."id"
FROM "FinanceEntity" fe
WHERE isr."entityId" IS NULL
  AND fe."userId" = isr."userId"
  AND fe."name" = 'Personal'
  AND fe."type" = 'PERSONAL'::"EntityType";

UPDATE "FinanceTransaction" ft
SET "entityId" = fe."id"
FROM "FinanceEntity" fe
WHERE ft."entityId" IS NULL
  AND fe."userId" = ft."userId"
  AND fe."name" = 'Personal'
  AND fe."type" = 'PERSONAL'::"EntityType";

-- Safety verification: fail migration if any financial row still has NULL entityId.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "WalletAccount" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Finance entity backfill failed: WalletAccount has NULL entityId rows.';
    END IF;
    IF EXISTS (SELECT 1 FROM "BudgetEnvelope" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Finance entity backfill failed: BudgetEnvelope has NULL entityId rows.';
    END IF;
    IF EXISTS (SELECT 1 FROM "LoanRecord" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Finance entity backfill failed: LoanRecord has NULL entityId rows.';
    END IF;
    IF EXISTS (SELECT 1 FROM "IncomeStream" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Finance entity backfill failed: IncomeStream has NULL entityId rows.';
    END IF;
    IF EXISTS (SELECT 1 FROM "FinanceTransaction" WHERE "entityId" IS NULL) THEN
        RAISE EXCEPTION 'Finance entity backfill failed: FinanceTransaction has NULL entityId rows.';
    END IF;
END $$;

-- CreateIndex
CREATE INDEX "FinanceEntity_userId_createdAt_idx" ON "FinanceEntity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceEntity_userId_type_idx" ON "FinanceEntity"("userId", "type");

-- CreateIndex
CREATE INDEX "BudgetEnvelope_entityId_isArchived_isSystem_sortOrder_idx" ON "BudgetEnvelope"("entityId", "isArchived", "isSystem", "sortOrder");

-- CreateIndex
CREATE INDEX "BudgetEnvelope_entityId_name_idx" ON "BudgetEnvelope"("entityId", "name");

-- CreateIndex
CREATE INDEX "FinanceTransaction_entityId_postedAt_idx" ON "FinanceTransaction"("entityId", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_entityId_kind_postedAt_idx" ON "FinanceTransaction"("entityId", "kind", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_entityId_budgetEnvelopeId_postedAt_idx" ON "FinanceTransaction"("entityId", "budgetEnvelopeId", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_entityId_walletAccountId_postedAt_idx" ON "FinanceTransaction"("entityId", "walletAccountId", "postedAt");

-- CreateIndex
CREATE INDEX "IncomeStream_entityId_isActive_idx" ON "IncomeStream"("entityId", "isActive");

-- CreateIndex
CREATE INDEX "LoanRecord_entityId_direction_status_idx" ON "LoanRecord"("entityId", "direction", "status");

-- CreateIndex
CREATE INDEX "LoanRecord_entityId_status_idx" ON "LoanRecord"("entityId", "status");

-- CreateIndex
CREATE INDEX "WalletAccount_entityId_type_isArchived_idx" ON "WalletAccount"("entityId", "type", "isArchived");

-- CreateIndex
CREATE INDEX "WalletAccount_entityId_isArchived_name_idx" ON "WalletAccount"("entityId", "isArchived", "name");

-- AddForeignKey
ALTER TABLE "FinanceEntity" ADD CONSTRAINT "FinanceEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEnvelope" ADD CONSTRAINT "BudgetEnvelope_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRecord" ADD CONSTRAINT "LoanRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
