/*
  Warnings:

  - You are about to alter the column `monthlyTargetPhp` on the `BudgetEnvelope` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `availablePhp` on the `BudgetEnvelope` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `amountPhp` on the `FinanceTransaction` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `defaultAmountPhp` on the `IncomeStream` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `principalPhp` on the `LoanRecord` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `monthlyDuePhp` on the `LoanRecord` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `paidToDatePhp` on the `LoanRecord` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `remainingPhp` on the `LoanRecord` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `currentBalancePhp` on the `WalletAccount` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `creditLimitPhp` on the `WalletAccount` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `currentValuePhp` on the `WalletEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.
  - You are about to alter the column `initialInvestmentPhp` on the `WalletEntry` table. The data in that column could be lost. The data in that column will be cast from `Decimal` to `Decimal(65,30)`.

*/
-- AlterTable
ALTER TABLE "BudgetEnvelope" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "monthlyTargetPhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "availablePhp" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "FinanceTransaction" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "amountPhp" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "IncomeStream" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "defaultAmountPhp" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "LoanRecord" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "principalPhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "monthlyDuePhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "paidToDatePhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "remainingPhp" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "MonthlyOverviewEntry" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text);

-- AlterTable
ALTER TABLE "WalletAccount" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "currentBalancePhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "creditLimitPhp" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "WalletEntry" ALTER COLUMN "id" SET DEFAULT md5((random())::text || (clock_timestamp())::text),
ALTER COLUMN "currentValuePhp" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "initialInvestmentPhp" SET DATA TYPE DECIMAL(65,30);
