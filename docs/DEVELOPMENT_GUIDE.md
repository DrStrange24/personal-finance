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

## Prisma Migration Safety

- Do not edit `prisma/migrations/*/migration.sql` after that migration has been applied to any database.
- If schema changes are needed, update `prisma/schema.prisma`.
- Then create a new migration manually (human developer) with an explicit initiative/feature-oriented name:

```bash
npx prisma migrate dev --name your-change-name
```

- Use kebab-case and clear intent for migration names (example: `wallet-balance-precision-fix`, `add-income-stream-indexes`).

- If a previously applied migration file was accidentally edited, restore that file content to the original version instead of rewriting migration history.

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
npm run build
```

## Workbook Import Development Workflow

1. Start app and log in.
2. Open `/dashboard`.
3. Use **Workbook Import (.xlsx)** card.
4. Parse workbook (`/api/imports/workbook`).
5. Commit staged import (`/api/imports/commit`).

## Data Access Rules

- Prefer Server Components for page data.
- Use `app/api/*` endpoints for browser file upload/import flows.
- Keep Prisma access server-side only.

## Reusable UI Placement

- Shared components go under `app/components/`.
- Finance shared components are under `app/components/finance/`.

## Destructive Action Rule

- Always use a confirmation modal for every delete/archive/removal action before submitting.
- This rule applies to all modules and routes.
- Reuse `app/components/confirmation-modal.tsx` (directly or via wrapper components) to keep behavior consistent.

## Action UI Rule

- For add/edit/delete actions, use icon-only action buttons as triggers.
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
