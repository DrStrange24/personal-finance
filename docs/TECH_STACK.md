# Tech Stack

This document lists the technologies currently used in this project.

## Maintenance Rule

- Keep this file up to date.
- If a technology is added, changed, or removed, update this file in the same PR/commit.

## Core Framework

- Next.js `16.1.6` (App Router)
- React `19.2.3`
- TypeScript `5.x`

## Frontend and Styling

- React Bootstrap `2.10.10`
- Bootstrap `5.3.8`
- Sass (`scss`) `1.97.3`
- `next/font` (Space Grotesk and Space Mono)

## Backend and Auth

- Next.js Route Handlers (`app/api/*`)
- JWT-based sessions via `jsonwebtoken` `9.0.2`
- Password hashing via `bcryptjs` `3.0.2`
- HTTP-only auth cookie: `pf_session`

## Database and ORM

- PostgreSQL
- Prisma ORM `6.16.1`
- Prisma Client `@prisma/client` `6.16.1`

## Tooling

- ESLint `9.x`
- `eslint-config-next` `16.1.6`
- Vitest `4.x`
- Type definitions: `@types/node`, `@types/react`, `@types/react-dom`, `@types/jsonwebtoken`, `@types/bcryptjs`

## Runtime and Package Management

- Node.js (required by Next.js/Prisma toolchain)
- npm (`package-lock.json` present)
