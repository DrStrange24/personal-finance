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
  - Quick transaction posting flow.
  - Recent transactions table.
  - Credit card status card.

- Ledger:
  - `/transactions` unified transaction list.
  - Filters by kind, wallet, and remarks search.
  - Posting form supporting income/expense/all key transaction kinds.
  - Transaction delete with automatic balance reversal.

- Wallet Accounts:
  - `/wallet` account management for:
    - cash
    - bank
    - e-wallet
    - asset
    - credit card
  - Balance updates and account archival.
  - Credit card fields: credit limit, statement closing day, statement due day.

- Income:
  - `/income` income stream management.
  - Income posting to wallet + budget envelope.

- Budget:
  - `/budget` envelope budgeting.
  - Envelope create/update.
  - Budget allocation posting (`wallet -> envelope`).
  - Envelope table with target/available/spent/remaining.

- Loan:
  - `/loan` loan records for:
    - `YOU_OWE`
    - `YOU_ARE_OWED`
  - Loan create/status updates.
  - Loan borrow and repayment posting tied to ledger.

- Workbook Import:
  - Parse `.xlsx` workbook (`/api/imports/workbook`) with 6-sheet support.
  - Commit staged import (`/api/imports/commit`).
  - Mapping into wallet accounts, income streams, budget envelopes, loans, and monthly overview compatibility rows.

- Legacy Compatibility:
  - `/monthly-overview` remains active.
  - Existing `WalletEntry` and `MonthlyOverviewEntry` models retained.
  - Bootstrap migration maps legacy wallet entries to new wallet accounts when needed.

## API

- Auth:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `POST /api/auth/logout`
- Imports:
  - `POST /api/imports/workbook`
  - `POST /api/imports/commit`
