# Architecture

## App Router

- Pages live under app/ and use server or client components as needed.
- API route handlers live under app/api.

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

- Global styles are defined in `app/globals.scss`.
- Route and component styles are defined with Sass modules (`*.module.scss`).

## Data Layer

- Prisma connects the app to PostgreSQL.
- User records are stored in the database with hashed passwords.
