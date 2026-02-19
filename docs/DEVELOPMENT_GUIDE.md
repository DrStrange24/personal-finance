# Development Guide

## Requirements

- Node.js 20+
- PostgreSQL
- npm

## Environment Variables

Create a .env.local file in the project root:

- DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
- JWT_SECRET=your-long-random-string

The JWT secret must be set for login and signup to work.

## Install

npm install

Frontend styling stack in this project includes:
- Sass (`sass`) for global tokens/overrides.
- React Bootstrap (`react-bootstrap`) + Bootstrap CSS for UI components.

All required packages are installed via `npm install`.

## Database Setup

1. Initialize Prisma and apply migrations:
   - npx prisma migrate dev --name init
2. Generate Prisma client (if needed):
   - npx prisma generate

## Run

npm run dev

If port 3000 is already in use:

npm run dev -- -p 3002

## Theming Rules

- The app supports both dark and light themes globally.
- All new UI code must use semantic CSS variables from `app/styles/_theme-tokens.scss` (for example `var(--color-text-primary)`), not hardcoded hex/rgb values.
- Theme selection is stored in `localStorage` under `pf-theme` and applied on the root html element as `data-theme`.
- Keep React Bootstrap colors/theme aligned by overriding Bootstrap CSS variables in `app/styles/_theme-tokens.scss`.
- Keep `app/globals.scss` as the import entrypoint only; global style organization belongs in `app/styles/`.
- Follow folder placement policy in `AGENTS.md` and `docs/FOLDER_STRUCTURE_CONVENTIONS.md`.
