# Project Structure

- app/
  - (auth)/
    - login/ (login page)
    - signup/ (signup page)
  - api/
    - auth/
      - login/ (login endpoint)
      - signup/ (signup endpoint)
  - globals.css
  - layout.tsx
  - page.tsx
- lib/
  - auth.ts (JWT helpers)
  - prisma.ts (Prisma client)
- prisma/
  - schema.prisma
- public/

Notes:
- The App Router is used for pages and API route handlers.
- Auth routes live in app/api.
