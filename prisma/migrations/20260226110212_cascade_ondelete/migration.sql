-- DropForeignKey
ALTER TABLE "BudgetEnvelope" DROP CONSTRAINT "BudgetEnvelope_entityId_fkey";

-- DropForeignKey
ALTER TABLE "FinanceTransaction" DROP CONSTRAINT "FinanceTransaction_entityId_fkey";

-- DropForeignKey
ALTER TABLE "IncomeStream" DROP CONSTRAINT "IncomeStream_entityId_fkey";

-- DropForeignKey
ALTER TABLE "LoanRecord" DROP CONSTRAINT "LoanRecord_entityId_fkey";

-- DropForeignKey
ALTER TABLE "WalletAccount" DROP CONSTRAINT "WalletAccount_entityId_fkey";

-- AddForeignKey
ALTER TABLE "WalletAccount" ADD CONSTRAINT "WalletAccount_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeStream" ADD CONSTRAINT "IncomeStream_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetEnvelope" ADD CONSTRAINT "BudgetEnvelope_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoanRecord" ADD CONSTRAINT "LoanRecord_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "FinanceEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
