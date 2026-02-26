# Architecture

## App Router

- App routes are in `app/`.
- Protected routes are grouped under `app/(app)` and require a valid `pf_session`.
- Public auth routes are under `app/(auth)`.
- API handlers are in `app/api`.

## Auth Flow

1. User submits login/signup form.
2. Client calls `/api/auth/login` or `/api/auth/signup`.
3. Server validates credentials and issues JWT.
4. JWT is stored as `pf_session` HTTP-only cookie.
5. Client redirects to `/dashboard`.
6. Protected routes verify cookie server-side and redirect to `/login` if invalid.
7. Logout calls `POST /api/auth/logout`.

## Finance Domain Model

Primary models:

- `WalletAccount` (cash, bank, e-wallet, credit card)
- `Investment` (initial investment + unit value + PHP value)
- `IncomeStream`
- `BudgetEnvelope` (including hidden system envelopes)
- `LoanRecord`
- `FinanceTransaction` (ledger)

Legacy compatibility models:

- `MonthlyOverviewEntry`

Enums:

- `WalletAccountType`
- `TransactionKind`
- `LoanDirection`
- `LoanStatus`

## Transaction Posting Engine

Central posting logic lives in `lib/finance/posting-engine.ts`.
Create-flow orchestration shared by Dashboard and Transactions routes lives in
`lib/finance/transaction-orchestration.ts`.

Delete behavior is reversal-based (no hard delete).

Implemented behavior:

- `INCOME`: wallet +, budget envelope +
- `EXPENSE`: wallet -, budget envelope -
- `BUDGET_ALLOCATION`: wallet -, budget envelope +
- `TRANSFER`: source wallet -, target wallet +, uses system envelope
- `CREDIT_CARD_CHARGE`: credit-card wallet debt +, budget envelope -
- `CREDIT_CARD_PAYMENT`: cash wallet -, credit-card wallet debt -, uses system envelope
- `LOAN_BORROW`: wallet +, loan remaining +, uses system envelope
- `LOAN_REPAY`: wallet -, loan paid + and remaining -, uses system envelope
- `ADJUSTMENT`: wallet +/- (requires reason code + remarks)

Audit fields on `FinanceTransaction`:

- `actorUserId`
- `adjustmentReasonCode`
- `isReversal`
- `reversedTransactionId`
- `voidedAt`
- `voidedByUserId`

Active query contract for KPI/list views:

- `isReversal = false`
- `voidedAt IS NULL`

System envelopes are auto-created in bootstrap:

- `System: Transfer`
- `System: Credit Payment`
- `System: Loan Inflow`
- `System: Loan Payment`

## Bootstrap and Migration Compatibility

`lib/finance/bootstrap.ts` ensures a user has:

- system envelopes
- default budget envelope (if none)
- default income streams (if none)

Legacy monthly overview is preserved and still served by `/monthly-overview`.

## Workbook Import

Two-step import flow:

1. `POST /api/imports/workbook`
   - accepts `.xlsx`
   - parses workbook with `xlsx` package (`lib/import/workbook.ts`)
   - stages parsed content in in-memory staging store
2. `POST /api/imports/commit`
   - reads staged import by `importId`
   - commits into wallet accounts, investments, income streams, budgets, loans, and monthly overview compatibility rows
   - wallet balance reconciliation uses posting-engine adjustment flows

## Styling

- Global style entrypoint: `app/globals.scss`
- Global sources:
  - `app/styles/_theme-tokens.scss`
  - `app/styles/_base.scss`
  - `app/styles/_components.scss`
- Route-level styles remain in co-located `*.module.scss`.
