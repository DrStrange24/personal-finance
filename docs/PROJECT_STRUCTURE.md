# Project Structure

- app/
  - (app)/
    - layout.tsx (protected app shell with persistent sidebar)
    - layout.module.scss
    - app-sidebar.module.scss
    - wallet/ (main authenticated page)
      - page.module.scss
    - monthly-overview/ (monthly overview placeholder page)
      - page.module.scss
  - (auth)/
    - layout.tsx (unauthenticated auth pages layout)
    - layout.module.scss
    - login/ (login page)
      - page.module.scss
    - signup/ (signup page)
      - page.module.scss
  - api/
    - auth/
      - login/ (login endpoint)
      - logout/ (logout endpoint)
      - signup/ (signup endpoint)
  - globals.scss
  - layout.tsx
  - page.tsx
  - page.module.scss
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
- Styling uses Sass with global styles in `app/globals.scss` and component-scoped styles in `*.module.scss`.
