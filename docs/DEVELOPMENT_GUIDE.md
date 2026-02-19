# Development Guide

## Requirements

- Node.js 20+
- PostgreSQL

## Environment Variables

Create a .env.local file in the project root:

- DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
- JWT_SECRET=your-long-random-string

The JWT secret must be set for login and signup to work.

## Install

npm install

## Database Setup

1. Initialize Prisma and apply migrations:
   - npx prisma migrate dev --name init
2. Generate Prisma client (if needed):
   - npx prisma generate

## Run

npm run dev
