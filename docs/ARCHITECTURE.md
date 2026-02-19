# Architecture

## App Router

- Pages live under app/ and use server or client components as needed.
- API route handlers live under app/api.

## Auth Flow

1. User submits login or signup form.
2. The client sends a POST request to /api/auth/login or /api/auth/signup.
3. The API validates input, hashes or verifies the password, and creates a JWT.
4. The JWT is stored in the `pf_session` HTTP-only cookie for subsequent requests.

## Data Layer

- Prisma connects the app to PostgreSQL.
- User records are stored in the database with hashed passwords.
