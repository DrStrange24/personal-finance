Personal Finance is a [Next.js](https://nextjs.org) app for transaction-first personal money management.

## Documentation Workflow

Read relevant docs before making code changes. If docs are missing or outdated, update docs first or alongside code changes.

Project documentation lives in `docs/`.

- Folder placement policy: `AGENTS.md` and `docs/FOLDER_STRUCTURE_CONVENTIONS.md`
- Technology inventory: `docs/TECH_STACK.md`
- Data access convention: prefer Server Components for page data; use `app/api/*` from Client Components for browser-driven operations
- Posting engine rule matrix: `docs/POSTING_ENGINE_MATRIX.md`

## Current App Routes

- Public:
  - `/` marketing page
  - `/login`
  - `/signup`
- Authenticated (requires `pf_session` cookie):
  - `/dashboard` quick actions + key finance metrics
  - `/transactions` unified ledger with filters and modal add/edit/delete actions
  - `/income` income stream setup and management
  - `/investment` investment register with unit value + PHP value CRUD
  - `/budget` envelope budgeting and allocation
  - `/loan` loan register (`you owe` and `you are owed`) + modal actions for repayment, borrow, and loan record creation
  - `/credit` credit card account CRUD table with modal add/edit and archive actions
  - `/wallet` wallet account management (cash/bank/e-wallet) with grouped cards and modal add/edit flows
  - `/entity` finance entity management (create/edit/delete/set active)
  - `/monthly-overview` historical wallet snapshot table/chart (legacy-compatible page)

Entity scope:

- The authenticated shell includes an entity selector (Personal/Business).
- Entity-scoped financial pages and posting operations resolve `activeEntityId` from session cookie (`pf_entity`) and local storage fallback UX state.

## Getting Started

Install dependencies:

```bash
npm install
```

Apply Prisma migrations:

```bash
npx prisma migrate dev
```

AI agent safety rule:

- AI agents must not execute `npx prisma migrate dev` or `npx prisma migrate reset`.
- AI agents should update `prisma/schema.prisma` only for DB model changes.
- AI agents should not create or edit migration folders/files unless explicitly requested by the user.
- The user runs migration commands manually.

Migration rule:

- Do not edit `prisma/migrations/*/migration.sql` after it has been applied.
- Make further DB changes by creating a new migration manually after schema updates.
- When creating migrations, always provide a clear initiative/feature name:
  - `npx prisma migrate dev --name <initiative-name>`
- For data-migration SQL steps, use guarded/idempotent patterns:
  - insert/create rows with `IF NOT EXISTS` semantics
  - delete rows with `IF EXISTS` semantics
- For foreign keys, default to `ON DELETE CASCADE` and `ON UPDATE CASCADE` unless a requirement explicitly says otherwise.

Generate Prisma client (if needed):

```bash
npx prisma generate
```

After applying Sprint 2 migrations manually, run entity-scope verification:

```bash
npm run verify:sprint2-entity-scope
```

Run development server:

```bash
npm run dev
```

Run tests:

```bash
npm run test
```

Open [http://localhost:3000](http://localhost:3000).

## Finance Model (Phase)

- PHP-only currency model.
- `FinanceEntity` is the accounting boundary for `WalletAccount`, `CreditAccount`, `Investment`, `BudgetEnvelope`, `LoanRecord`, `IncomeStream`, and `FinanceTransaction`.
- Posting engine strictly validates entity consistency across linked records (wallet/budget/loan/income/target wallet).
- Sprint 3 debt-aware credit logic is enabled:
  - `CREDIT_CARD_CHARGE` increases debt, decreases spend envelope, and increases a per-card CC payment reserve envelope.
  - `CREDIT_CARD_PAYMENT` decreases cash, decreases debt, and consumes that per-card reserve envelope.
  - credit-card payments are not treated as expenses.
- Every manual add/deduct flow records a ledger transaction with `actorUserId`.
- Transaction delete is reversal-based (no hard delete): reversal row + voided original linkage.
- Active KPI/list queries exclude reversal rows and voided originals (`isReversal = false`, `voidedAt IS NULL`).
- Active-name uniqueness for `CreditAccount` and `Investment` is enforced per `(userId, entityId, name)` for non-archived rows.
- Investments are managed in entity-scoped `Investment` records with unit value tracking and estimated PHP valuation in UI.
- Envelope budgeting is supported through `BudgetEnvelope` + `BUDGET_ALLOCATION`.
- Credit accounts are managed in entity-scoped `CreditAccount` records via `/credit` and display linked reserve balances.
- `BudgetEnvelope` supports system typing (`TRANSFER`, `CREDIT_CARD_PAYMENT`, `LOAN_INFLOW`, `LOAN_PAYMENT`) and optional per-card linkage.
- Sprint 5 performance/reporting readiness is enabled:
  - dashboard KPI queries use grouped aggregates with entity scoping
  - `/transactions` uses server-side pagination (`50` rows/page)
  - KPI query failures degrade safely in UI (`-`) with server logs
  - legacy `MonthlyOverviewEntry` remains isolated from modern entity KPI computation
- Legacy `MonthlyOverviewEntry` remains user-scoped by design for migration compatibility.

## Styling

- Frontend UI uses React Bootstrap and Bootstrap CSS.
- Global stylesheet entrypoint is `app/globals.scss`.
- Global style sources are in `app/styles/`:
  - `_theme-tokens.scss`
  - `_base.scss`
  - `_components.scss`

## UX Safety Rule

- For add/edit/delete actions across all modules, use icon-only action buttons that open modal workflows.
- Destructive actions (delete/archive/removal) must always use a confirmation modal before submit across all modules.
- Prefer `app/components/confirmation-modal.tsx` (or wrappers based on it) for consistency.
- Create/edit/save actions submitted from modals should close the modal when submit completes.
- For add/edit/delete actions, always show toast feedback for both success and failure.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
