# Project Structure

- app/
  - (app)/
    - layout.tsx (protected app shell with persistent sidebar)
    - wallet/ (main authenticated page)
    - monthly-overview/ (monthly overview placeholder page)
  - (auth)/
    - layout.tsx (unauthenticated auth pages layout)
    - login/ (login page)
    - signup/ (signup page)
  - api/
    - auth/
      - login/ (login endpoint)
      - logout/ (logout endpoint)
      - signup/ (signup endpoint)
  - globals.css
  - layout.tsx
  - page.tsx
- lib/
  - auth.ts (JWT sign + verify helpers)
  - prisma.ts (Prisma client)
- prisma/
  - schema.prisma
- public/

Notes:
- The App Router is used for pages and API route handlers.
- Auth endpoints live in `app/api`.
- Protected pages live in `app/(app)` and redirect to `/login` when `pf_session` is missing/invalid.
