-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "initialInvestmentPhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currentValuePhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Investment_userId_isArchived_name_idx" ON "Investment"("userId", "isArchived", "name");

-- CreateIndex
CREATE INDEX "Investment_userId_createdAt_idx" ON "Investment"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate wallet assets to investment table.
INSERT INTO "Investment" (
    "id",
    "userId",
    "name",
    "initialInvestmentPhp",
    "currentValuePhp",
    "remarks",
    "isArchived",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "userId",
    "name",
    "currentBalanceAmount",
    "currentBalanceAmount",
    'Migrated from wallet asset account.',
    false,
    "createdAt",
    NOW()
FROM "WalletAccount"
WHERE "type" = 'ASSET';

-- Hide migrated asset wallet rows from wallet UI.
UPDATE "WalletAccount"
SET
    "isArchived" = true,
    "updatedAt" = NOW()
WHERE "type" = 'ASSET' AND "isArchived" = false;

-- Credit metadata moved out of wallet domain.
ALTER TABLE "WalletAccount" DROP COLUMN IF EXISTS "creditLimitPhp";
ALTER TABLE "WalletAccount" DROP COLUMN IF EXISTS "statementClosingDay";
ALTER TABLE "WalletAccount" DROP COLUMN IF EXISTS "statementDueDay";
