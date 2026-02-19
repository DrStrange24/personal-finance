-- CreateTable
CREATE TABLE "MonthlyOverviewEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "walletAmount" DECIMAL(65,30) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyOverviewEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyOverviewEntry_userId_entryDate_idx" ON "MonthlyOverviewEntry"("userId", "entryDate");

-- AddForeignKey
ALTER TABLE "MonthlyOverviewEntry" ADD CONSTRAINT "MonthlyOverviewEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
