# Development Guide

## Requirements

- Node.js 20+
- PostgreSQL
- npm

## Environment Variables

Create `.env.local` in project root:

- `DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB`
- `JWT_SECRET=your-long-random-string`

## Install

```bash
npm install
```

## Database Setup

Apply migrations:

```bash
npx prisma migrate dev
```

This includes schema updates such as the wallet balance column rename (`currentBalancePhp` -> `currentBalanceAmount`).

AI agent safety rule:

- AI agents must not execute `npx prisma migrate dev` or `npx prisma migrate reset`.
- AI agents should update `prisma/schema.prisma` only for DB model changes.
- AI agents should not create or edit migration folders/files unless explicitly requested by the user.
- Migration commands must be run by a human developer.

Generate Prisma client:

```bash
npx prisma generate
```

After applying Sprint 2 migration manually, run entity-scope verification:

```bash
npm run verify:sprint2-entity-scope
```

The verifier is read-only and reports:

- NULL `entityId` rows for `CreditAccount` and `Investment`
- orphan/cross-user `FinanceEntity` references
- active duplicate name groups within `(userId, entityId, name)`
- total row counts per model

## Prisma Migration Safety

- Do not edit `prisma/migrations/*/migration.sql` after that migration has been applied to any database.
- If schema changes are needed, update `prisma/schema.prisma`.
- Then create a new migration manually (human developer) with an explicit initiative/feature-oriented name:

```bash
npx prisma migrate dev --name your-change-name
```

- Use kebab-case and clear intent for migration names (example: `wallet-balance-precision-fix`, `add-income-stream-indexes`).

- If a previously applied migration file was accidentally edited, restore that file content to the original version instead of rewriting migration history.

### SQL Guardrail For Migration Updates

- When writing or updating migration SQL data steps, make operations idempotent with existence checks.
- Insert/create data rows with `IF NOT EXISTS` semantics (for example, `INSERT ... SELECT ... WHERE NOT EXISTS (...)`).
- Delete/remove data rows with `IF EXISTS` semantics (for example, `DELETE ... WHERE EXISTS (...)` or scoped `DELETE` predicates that only run when matching rows exist).
- Prefer guarded updates over blind writes so re-running migration logic does not corrupt or duplicate data.

### FK Action Default

- Default foreign-key behavior is `ON DELETE CASCADE` and `ON UPDATE CASCADE`.
- Use a non-cascade behavior (`RESTRICT`, `SET NULL`, etc.) only when explicitly required by the feature and documented in the PR/change notes.

## Run

```bash
npm run dev
```

If port 3000 is busy:

```bash
npm run dev -- -p 3002
```

## Build and Quality Checks

```bash
npm run lint
npm run test
npm run build
```

Test stack:

- Vitest (`vitest.config.ts`)
- Posting engine unit tests in `lib/finance/posting-engine.test.ts`

## Data Access Rules

- Prefer Server Components for page data.
- Use `app/api/*` endpoints for browser-driven operations.
- Keep Prisma access server-side only.
- Financial reads/writes must be scoped by `activeEntityId` (never by `userId` alone for entity-scoped models).
- `CreditAccount` and `Investment` are entity-scoped in Sprint 2 and must always include `entityId`.
- Sprint 3 credit-card reserve contract:
  - `CREDIT_CARD_CHARGE`: debt `+`, spend envelope `-`, CC payment reserve envelope `+`
  - `CREDIT_CARD_PAYMENT`: cash `-`, debt `-`, CC payment reserve envelope `-`
  - payment over debt or over reserve must fail.
- For transaction-driven KPIs/lists, filter to active canonical rows only:
  - `isReversal = false`
  - `voidedAt = null`
- Unallocated cash KPI must subtract CC payment reserves (not credit debt).
- Sprint 5 reporting/performance rules:
  - dashboard KPIs must remain entity-scoped and ledger-derived/reconcilable
  - `MonthlyOverviewEntry` is legacy-only and must not feed modern KPI totals
  - transactions list uses paginated server query (`50` rows/page)
  - prefer grouped aggregates over many independent aggregate round trips

## Reusable UI Placement

- Shared components go under `app/components/`.
- Finance shared components are under `app/components/finance/`.

## Destructive Action Rule

- Always use a confirmation modal for every delete/archive/removal action before submitting.
- This rule applies to all modules and routes.
- Reuse `app/components/confirmation-modal.tsx` (directly or via wrapper components) to keep behavior consistent.

## Action UI Rule

- For add/edit/delete actions, use icon-only action buttons as triggers.
- For add/remove controls inside dynamic form rows, use icon-only action buttons (not text buttons).
- Add and edit actions should open modal forms.
- Delete/archive/removal actions should trigger a confirmation modal before submit.
- Keep this behavior consistent when adding new features or tables.

## Modal Submit Behavior

- For create/edit/save modal forms, close the modal after submit completes.
- Apply this consistently so modal workflows behave the same across modules.

## Action Feedback Rule

- For add/edit/delete (and archive/removal) actions, always show a toast message for both success and failure outcomes.
- Prefer shared toast context via `app/components/toast-provider.tsx` for consistent behavior.

## Theming Rules

- Use semantic tokens from `app/styles/_theme-tokens.scss`.
- Do not hardcode colors in new UI when a token exists.
- Keep `app/globals.scss` as import entrypoint only.
