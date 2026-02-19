Personal Finance is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Documentation Workflow

Read relevant docs before making code changes. If docs are missing or outdated, update docs first or alongside code changes.

Project documentation lives in the docs/ folder.

## Current App Routes

- Public:
  - `/` marketing page
  - `/login`
  - `/signup`
- Authenticated (requires `pf_session` cookie):
  - `/wallet` (default post-login/post-signup landing page)
  - `/monthly-overview`

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

If port 3000 is busy, choose another port:

```bash
npm run dev -- -p 3002
```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) and [Space Mono](https://fonts.google.com/specimen/Space+Mono).

## Styling

- Frontend UI uses React Bootstrap (`react-bootstrap`) and Bootstrap CSS.
- Global theme tokens and overrides live in `app/globals.scss`.
- Layout/theme-specific modules still exist where needed (for example `app/(app)/layout.module.scss` and `app/theme-toggle.module.scss`).
- Migration/setup guide: `docs/FRONTEND_REACT_BOOTSTRAP.md`.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
