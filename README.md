Personal Finance is a [Next.js](https://nextjs.org) app for transaction-first personal money management.

## Documentation Workflow

Read relevant docs before making code changes. If docs are missing or outdated, update docs first or alongside code changes.

Project documentation lives in `docs/`.

- Folder placement policy: `AGENTS.md` and `docs/FOLDER_STRUCTURE_CONVENTIONS.md`
- Technology inventory: `docs/TECH_STACK.md`
- Data access convention: prefer Server Components for page data; use `app/api/*` from Client Components for browser-driven operations

## Current App Routes

- Public:
  - `/` marketing page
  - `/login`
  - `/signup`
- Authenticated (requires `pf_session` cookie):
  - `/dashboard` quick actions + key finance metrics + workbook import
  - `/transactions` unified ledger with filters and modal add/edit/delete actions
  - `/income` income stream setup and management
  - `/investment` investment register with unit value + PHP value CRUD
  - `/budget` envelope budgeting and allocation
  - `/loan` loan register (`you owe` and `you are owed`) + modal actions for repayment, borrow, and loan record creation
  - `/credit` credit card account CRUD table with modal add/edit and archive actions
  - `/wallet` wallet account management (cash/bank/e-wallet) with grouped cards and modal add/edit flows
  - `/monthly-overview` historical wallet snapshot table/chart (legacy-compatible page)

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

Generate Prisma client (if needed):

```bash
npx prisma generate
```

Run development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workbook Import Flow

1. Go to `/dashboard`.
2. In **Workbook Import (.xlsx)**, upload your `Finance - Personal.xlsx`.
3. Click **Parse Workbook**.
4. Review row counts.
5. Click **Commit Import**.

Supported workbook sheets:

- `Wallet`
- `Statistics`
- `Income`
- `Budget`
- `Loan`
- `Net Worth` (currently parsed but not used for active module pages)

## Finance Model (Phase)

- PHP-only currency model.
- Every manual add/deduct flow records a ledger transaction.
- Investments are managed in `Investment` records with unit value tracking and estimated PHP valuation in UI.
- Envelope budgeting is supported through `BudgetEnvelope` + `BUDGET_ALLOCATION`.
- Credit accounts are managed in dedicated `CreditAccount` records via `/credit`.
- Legacy `MonthlyOverviewEntry` remains for migration compatibility.

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
