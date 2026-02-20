-- CreateEnum
CREATE TYPE "WalletAccountType" AS ENUM ('CASH', 'BANK', 'E_WALLET', 'ASSET', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "TransactionKind" AS ENUM ('INCOME', 'EXPENSE', 'BUDGET_ALLOCATION', 'TRANSFER', 'CREDIT_CARD_CHARGE', 'CREDIT_CARD_PAYMENT', 'LOAN_BORROW', 'LOAN_REPAY', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LoanDirection" AS ENUM ('YOU_OWE', 'YOU_ARE_OWED');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'PAID', 'WRITTEN_OFF');

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

-- CreateTable
CREATE TABLE "WalletAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WalletAccountType" NOT NULL,
    "currentBalancePhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "creditLimitPhp" DECIMAL(65,30),
    "statementClosingDay" INTEGER,
    "statementDueDay" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeStream" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultAmountPhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeStream_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetEnvelope" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyTargetPhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availablePhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rolloverEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payTo" TEXT,
    "remarks" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetEnvelope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoanRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "direction" "LoanDirection" NOT NULL,
    "itemName" TEXT NOT NULL,
    "counterparty" TEXT,
    "principalPhp" DECIMAL(65,30) NOT NULL,
    "monthlyDuePhp" DECIMAL(65,30),
    "paidToDatePhp" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "remainingPhp" DECIMAL(65,30) NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoanRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" "TransactionKind" NOT NULL,
    "amountPhp" DECIMAL(65,30) NOT NULL,
    "walletAccountId" TEXT NOT NULL,
    "targetWalletAccountId" TEXT,
    "budgetEnvelopeId" TEXT,
    "incomeStreamId" TEXT,
    "loanRecordId" TEXT,
    "countsTowardBudget" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MonthlyOverviewEntry_userId_entryDate_idx" ON "MonthlyOverviewEntry"("userId", "entryDate");

-- CreateIndex
CREATE INDEX "WalletAccount_userId_type_isArchived_idx" ON "WalletAccount"("userId", "type", "isArchived");

-- CreateIndex
CREATE INDEX "WalletAccount_userId_isArchived_name_idx" ON "WalletAccount"("userId", "isArchived", "name");

-- CreateIndex
CREATE INDEX "IncomeStream_userId_isActive_idx" ON "IncomeStream"("userId", "isActive");

-- CreateIndex
CREATE INDEX "BudgetEnvelope_userId_isArchived_isSystem_sortOrder_idx" ON "BudgetEnvelope"("userId", "isArchived", "isSystem", "sortOrder");

-- CreateIndex
CREATE INDEX "BudgetEnvelope_userId_name_idx" ON "BudgetEnvelope"("userId", "name");

-- CreateIndex
CREATE INDEX "LoanRecord_userId_direction_status_idx" ON "LoanRecord"("userId", "direction", "status");

-- CreateIndex
CREATE INDEX "LoanRecord_userId_status_idx" ON "LoanRecord"("userId", "status");

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_postedAt_idx" ON "FinanceTransaction"("userId", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_kind_postedAt_idx" ON "FinanceTransaction"("userId", "kind", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_budgetEnvelopeId_postedAt_idx" ON "FinanceTransaction"("userId", "budgetEnvelopeId", "postedAt");

-- CreateIndex
CREATE INDEX "FinanceTransaction_userId_walletAccountId_postedAt_idx" ON "FinanceTransaction"("userId", "walletAccountId", "postedAt");

-- AddForeignKey
ALTER TABLE "MonthlyOverviewEntry" ADD CONSTRAINT "MonthlyOverviewEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEnvelope" ADD CONSTRAINT "BudgetEnvelope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRecord" ADD CONSTRAINT "LoanRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_walletAccountId_fkey" FOREIGN KEY ("walletAccountId") REFERENCES "WalletAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_targetWalletAccountId_fkey" FOREIGN KEY ("targetWalletAccountId") REFERENCES "WalletAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_budgetEnvelopeId_fkey" FOREIGN KEY ("budgetEnvelopeId") REFERENCES "BudgetEnvelope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_incomeStreamId_fkey" FOREIGN KEY ("incomeStreamId") REFERENCES "IncomeStream"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_loanRecordId_fkey" FOREIGN KEY ("loanRecordId") REFERENCES "LoanRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
