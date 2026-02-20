-- CreateEnum
CREATE TYPE "WalletEntryType" AS ENUM ('CASH_WALLET', 'ASSET_HOLDING');

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL DEFAULT md5((random())::text || (clock_timestamp())::text),
    "userId" TEXT NOT NULL,
    "type" "WalletEntryType" NOT NULL,
    "groupName" TEXT,
    "name" TEXT NOT NULL,
    "currentValuePhp" DECIMAL NOT NULL,
    "initialInvestmentPhp" DECIMAL,
    "remarks" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletEntry_userId_type_sortOrder_idx" ON "WalletEntry"("userId", "type", "sortOrder");

-- CreateIndex
CREATE INDEX "WalletEntry_userId_isArchived_idx" ON "WalletEntry"("userId", "isArchived");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
