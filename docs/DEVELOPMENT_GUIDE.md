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

This project uses Sass for styling. The `sass` package is required and installed via `npm install`.

To use React Bootstrap for frontend components, install:

npm install react-bootstrap bootstrap

Then follow `docs/FRONTEND_REACT_BOOTSTRAP.md` for setup and migration patterns.

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
- All new UI code must use semantic CSS variables from `app/globals.scss` (for example `var(--color-text-primary)`), not hardcoded hex/rgb values in module files.
- Theme selection is stored in `localStorage` under `pf-theme` and applied on the root html element as `data-theme`.
- If React Bootstrap is used, keep colors/theme aligned by overriding Bootstrap CSS variables in `app/globals.scss`.
