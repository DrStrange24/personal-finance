# Features

## Current

- Auth:
  - User signup with email/name/password.
  - User login with email/password.
  - JWT session in HTTP-only `pf_session` cookie.
  - Protected app shell with persistent sidebar and logout.

- Dashboard and Core Finance:
  - `/dashboard` as post-auth landing page.
  - KPI cards (wallet balance, debt, net position, budget available, month income/expense/cashflow).
  - KPI fallback behavior (`-`) when aggregate query fails, with server-side diagnostics logging.
  - Quick transaction posting flow.
  - Recent transactions table.
  - Credit card status card.

- Ledger:
  - `/transactions` unified transaction list.
  - Filters by kind, wallet, and remarks search.
  - Date-range filtering and server-side pagination for large ledgers.
  - Add/edit/delete transaction actions via icon buttons with modal flows.
  - Transaction delete is reversal-based (reversal row + voided original, no hard delete).
  - Active ledger views/KPIs exclude reversal rows and voided originals.

- Wallet Accounts:
  - `/wallet` account management for:
    - cash
    - bank
    - e-wallet
  - Balance updates and account archival.

- Credit:
  - `/credit` dedicated credit card account management page.
  - Add/edit/archive credit accounts via icon actions with modal flows.
  - Table view with current balance tracking.
  - Used balance is no longer manually editable in credit forms (ledger-driven updates).

- Investments:
  - `/investment` investment management.
  - Add/edit/delete investment records via icon actions with modal flows.
  - Track initial investment, unit value, and PHP value with gain/loss totals.

- Income:
  - `/income` income stream management.
  - Add/edit/delete stream actions via icon buttons with modal flows.

- Budget:
  - `/budget` envelope budgeting.
  - Envelope create/update/delete via icon actions with modal flows.
  - Budget allocation posting (`wallet -> envelope`) via modal action.
  - Envelope table with target/available/spent/remaining.

- Loan:
  - `/loan` loan records for:
    - `YOU_OWE`
    - `YOU_ARE_OWED`
  - Loan create/status updates.
  - Loan borrow and repayment posting tied to ledger.

- Workbook Import:
  - Parse `.xlsx` workbook (`/api/imports/workbook`) with 6-sheet support.
  - Explicit import modes:
    - `BALANCE_BOOTSTRAP` for snapshot sheets (`Wallet`, `Statistics`, `Income`, `Budget`, `Loan`)
    - `FULL_LEDGER` for `Transactions` sheet posting rows
  - Durable DB-backed staging (`ImportBatch` + `ImportRow`) with deterministic idempotency keys.
  - Commit staged import by `batchId` (`/api/imports/commit`) with atomic all-or-nothing transaction.
  - Batch diagnostics endpoint (`/api/imports/{batchId}`) with row counters and row errors.
  - Mapping into wallet accounts, investments, income streams, budget envelopes, loans, and monthly overview compatibility rows.

- Legacy Compatibility:
  - `/monthly-overview` remains active.
  - Existing `MonthlyOverviewEntry` model retained.

## API

- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Imports:
  - `POST /api/imports/workbook`
  - `POST /api/imports/commit`
  - `GET /api/imports/{batchId}`
