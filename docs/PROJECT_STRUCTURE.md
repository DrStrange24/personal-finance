# Project Structure

- app/
  - (app)/
    - layout.tsx (protected app shell with persistent sidebar)
    - layout.module.scss
    - app-sidebar.tsx
    - wallet/ (main authenticated page)
    - monthly-overview/ (monthly overview placeholder page)
  - (auth)/
    - layout.tsx (unauthenticated auth pages layout)
    - layout.module.scss
    - login/ (login page)
    - signup/ (signup page)
  - api/
    - auth/
      - login/ (login endpoint)
      - logout/ (logout endpoint)
      - signup/ (signup endpoint)
  - globals.scss
  - layout.tsx
  - page.tsx
  - theme-toggle.module.scss
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
- Styling uses global Sass tokens/utilities in `app/globals.scss`, with React Bootstrap components for frontend UI.
- Theme colors follow semantic tokens (`--color-primary`, `--color-secondary`, `--color-tertiary`) defined in `app/globals.scss`.
- React Bootstrap adoption guide: `docs/FRONTEND_REACT_BOOTSTRAP.md`.
