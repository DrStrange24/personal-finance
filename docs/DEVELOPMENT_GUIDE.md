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

Generate Prisma client:

```bash
npx prisma generate --no-engine
```

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

## Theming Rules

- Use semantic tokens from `app/styles/_theme-tokens.scss`.
- Do not hardcode colors in new UI when a token exists.
- Keep `app/globals.scss` as import entrypoint only.
