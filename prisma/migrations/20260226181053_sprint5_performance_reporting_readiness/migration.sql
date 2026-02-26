-- Sprint 5: Performance & Reporting Readiness (WS5)
-- Manual migration draft (human execution required)
-- Adds reporting/performance indexes for entity-scoped ledger and master-data queries.

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_createdAt_idx"
    ON "FinanceTransaction"("entityId", "createdAt");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_kind_createdAt_idx"
    ON "FinanceTransaction"("entityId", "kind", "createdAt");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_walletAccountId_createdAt_idx"
    ON "FinanceTransaction"("entityId", "walletAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_targetWalletAccountId_createdAt_idx"
    ON "FinanceTransaction"("entityId", "targetWalletAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "FinanceTransaction_entityId_budgetEnvelopeId_createdAt_idx"
    ON "FinanceTransaction"("entityId", "budgetEnvelopeId", "createdAt");

CREATE INDEX IF NOT EXISTS "BudgetEnvelope_entityId_isArchived_idx"
    ON "BudgetEnvelope"("entityId", "isArchived");

CREATE INDEX IF NOT EXISTS "CreditAccount_entityId_isArchived_idx"
    ON "CreditAccount"("entityId", "isArchived");

CREATE INDEX IF NOT EXISTS "Investment_entityId_isArchived_idx"
    ON "Investment"("entityId", "isArchived");