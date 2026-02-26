# Posting Engine Matrix (Sprint 3)

This document is the canonical rule matrix for `lib/finance/posting-engine.ts`.

## Active Ledger Query Contract

Default KPI/list queries must only include active canonical transactions:

- `isReversal = false`
- `voidedAt IS NULL`

Reversal rows remain stored for audit use.

## Reversal Contract

Deleting a transaction does not hard-delete rows.

1. Validate ownership (`userId`, `entityId`) and that row is not already voided/reversed.
2. Post inverse side effects in the same Prisma transaction.
3. Create a reversal `FinanceTransaction` row with:
   - `isReversal = true`
   - `reversedTransactionId = <original id>`
   - `actorUserId` set to current user
4. Mark original row:
   - `voidedAt = now()`
   - `voidedByUserId = current user`

## TransactionKind Matrix

- `INCOME`
  - Required links: `walletAccountId`, `budgetEnvelopeId`
  - Effect: wallet `+`, envelope `+`
  - Validations: owned references, positive amount

- `EXPENSE`
  - Required links: `walletAccountId`, `budgetEnvelopeId`
  - Effect: wallet `-`, envelope `-`
  - Validations: wallet non-credit sufficient funds, envelope non-negative

- `BUDGET_ALLOCATION`
  - Required links: `walletAccountId`, `budgetEnvelopeId`
  - Effect: wallet `-`, envelope `+`
  - Validations: wallet non-credit sufficient funds

- `TRANSFER`
  - Required links: `walletAccountId`, `targetWalletAccountId`
  - Effect: source wallet `-`, target wallet `+`
  - Validations: source/target differ, source non-credit sufficient funds

- `CREDIT_CARD_CHARGE`
  - Required links: `walletAccountId` (credit card), `budgetEnvelopeId`
  - Effect: credit-card debt `+`, spend envelope `-`, per-card CC payment reserve envelope `+`
  - Validations:
    - spend envelope non-negative
    - credit limit not exceeded (when mapped credit account exists)
    - linked per-card reserve envelope exists or is auto-created

- `CREDIT_CARD_PAYMENT`
  - Required links: `walletAccountId` (cash wallet), `targetWalletAccountId` (credit card wallet)
  - Effect: cash wallet `-`, credit-card debt `-`, per-card CC payment reserve envelope `-`
  - Validations:
    - no overpay against outstanding debt
    - cash wallet sufficient funds
    - reserve envelope sufficient funds (partial reserve consumption is not allowed)

- `LOAN_BORROW`
  - Required links: `walletAccountId`, `loanRecordId`
  - Effect: wallet `+`, loan remaining `+`
  - Validations: loan not written off

- `LOAN_REPAY`
  - Required links: `walletAccountId`, `loanRecordId`
  - Effect: wallet `-`, loan paid `+`, loan remaining `-`
  - Validations: no overpay, wallet sufficient funds, loan status repayable

- `ADJUSTMENT`
  - Required links: `walletAccountId`
  - Effect: wallet `+/-` (signed amount)
  - Validations: non-zero amount, required `adjustmentReasonCode`, required remarks

## Adjustment Guardrail

Every `ADJUSTMENT` row must include:

- `adjustmentReasonCode`
- non-empty `remarks`
- `actorUserId`

## Credit Reserve Linkage

- Per-card reserve envelopes are system envelopes with:
  - `systemType = CREDIT_CARD_PAYMENT`
  - optional linkage fields: `linkedWalletAccountId`, `linkedCreditAccountId`
- `FinanceTransaction.ccPaymentEnvelopeId` stores the envelope used by charge/payment for reversal-safe replay.
