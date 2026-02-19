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

## Database Setup

1. Initialize Prisma and apply migrations:
   - npx prisma migrate dev --name init
2. Generate Prisma client (if needed):
   - npx prisma generate

## Run

npm run dev

If port 3000 is already in use:

npm run dev -- -p 3002
