# Features

## Current

- User signup with email, name, and password.
- User login with email and password.
- JWT session stored in an HTTP-only cookie.
- Protected app shell for authenticated pages.
- Persistent sidebar on authenticated pages with:
  - Wallet
  - Monthly Overview
  - Logout
- Wallet page (`/wallet`) as the default post-auth landing page.
- Monthly overview table page (`/monthly-overview`) with Date, Wallet (PHP), and Remarks columns.
- Monthly overview add/edit entry flows via modal forms, plus per-row delete action.
- Monthly overview chart modal with zoom in/out and pan controls.

## API

- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
