-- AlterTable
ALTER TABLE "FinanceEntity" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "FinanceEntity_userId_isArchived_createdAt_idx" ON "FinanceEntity"("userId", "isArchived", "createdAt");
