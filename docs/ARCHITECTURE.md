# Architecture

## App Router

- Pages live under app/ and use server or client components as needed.
- API route handlers live under app/api.
- Server Components are the default for page-level data loading.
- Client Components should call `/api/*` for browser-driven reads/writes.

## Auth Flow

1. User submits login or signup form.
2. The client sends a POST request to /api/auth/login or /api/auth/signup.
3. The API validates input, hashes or verifies the password, and creates a JWT.
4. The JWT is stored in the `pf_session` HTTP-only cookie for subsequent requests.
5. On success, the client navigates to `/wallet`.
6. Protected routes in `app/(app)` verify `pf_session` on the server and redirect to `/login` if invalid.
7. Logout calls `POST /api/auth/logout`, clears `pf_session`, and redirects the client to `/login`.

## UI Shell

- Authenticated pages share `app/(app)/layout.tsx`.
- The layout renders a persistent sidebar and page content area.
- Sidebar links: `/wallet`, `/monthly-overview`, and a logout action.

## Styling

- Global stylesheet entrypoint is `app/globals.scss`.
- Global style source files are organized in `app/styles/`:
  - `_theme-tokens.scss` for CSS variables and Bootstrap mapping.
  - `_base.scss` for reset/base element styles.
  - `_components.scss` for shared global utility/component classes.
- Route and component styles are defined with Sass modules (`*.module.scss`).
- Theme tokens are defined as CSS variables in `app/styles/_theme-tokens.scss`.
- Color mode is set on `<html data-theme="light|dark">` and persisted in `localStorage` using the `pf-theme` key.
- `app/theme-toggle.tsx` provides the global theme switcher and is mounted from `app/layout.tsx`.

## Data Layer

- Prisma connects the app to PostgreSQL.
- User records are stored in the database with hashed passwords.
- Server Components may read data directly from Prisma/server utilities.
- API handlers are required for client-triggered mutations and external consumers.
