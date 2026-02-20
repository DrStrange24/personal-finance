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
  - `/transactions` unified ledger with filters and posting form
  - `/income` income stream setup and income posting
  - `/budget` envelope budgeting and allocation
  - `/loan` loan register (`you owe` and `you are owed`) + repayment/borrow posting
  - `/wallet` wallet account management (cash/bank/e-wallet/asset/credit card) with grouped cards and modal add/edit flows
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
- Envelope budgeting is supported through `BudgetEnvelope` + `BUDGET_ALLOCATION`.
- Credit cards are modeled as `CREDIT_CARD` wallet accounts and tracked through:
  - `CREDIT_CARD_CHARGE`
  - `CREDIT_CARD_PAYMENT`
- Legacy `WalletEntry` and `MonthlyOverviewEntry` remain for migration compatibility.

## Styling

- Frontend UI uses React Bootstrap and Bootstrap CSS.
- Global stylesheet entrypoint is `app/globals.scss`.
- Global style sources are in `app/styles/`:
  - `_theme-tokens.scss`
  - `_base.scss`
  - `_components.scss`

## UX Safety Rule

- Destructive actions (delete/archive/removal) must always use a confirmation modal before submit across all modules.
- Prefer `app/components/confirmation-modal.tsx` (or wrappers based on it) for consistency.
- Create/edit/save actions submitted from modals should close the modal when submit completes.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
