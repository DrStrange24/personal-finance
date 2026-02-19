# Frontend: React Bootstrap

This guide explains how to use React Bootstrap in this Next.js App Router project, and how to migrate existing Sass module UI incrementally.

## 1) Install Dependencies

```bash
npm install react-bootstrap bootstrap
```

## 2) Load Bootstrap CSS Once

Import Bootstrap CSS in the root layout (`app/layout.tsx`) together with existing global styles:

```tsx
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.scss";
```

Keep the import at the app root so styles are loaded once for all routes.

## 3) Use React Bootstrap Components

For interactive UI, create or update Client Components (`"use client"`):

```tsx
"use client";

import Button from "react-bootstrap/Button";
import Card from "react-bootstrap/Card";

export default function BudgetCard() {
  return (
    <Card className="shadow-sm border-0">
      <Card.Body>
        <Card.Title>Monthly Budget</Card.Title>
        <Button variant="success">Add Transaction</Button>
      </Card.Body>
    </Card>
  );
}
```

You can render these client components inside existing server route pages.

## 4) Theming and Visual Consistency

This project already uses CSS variables in `app/globals.scss` for dark/light theme. Keep those variables as the source of truth.

Use Bootstrap variable overrides in `app/globals.scss` so React Bootstrap components follow the same theme:

```scss
:root {
  --bs-body-bg: var(--color-bg-page);
  --bs-body-color: var(--color-text-primary);
  --bs-border-color: var(--color-border-default);
  --bs-primary: var(--color-primary);
  --bs-success: var(--color-secondary);
  --bs-info: var(--color-tertiary);
}
```

Set overrides for both base `:root` and `:root[data-theme="light"]` where needed.

Implementation note:

- `app/globals.scss` is the global import entrypoint for Next.js.
- Keep actual token/base/component global style source in `app/styles/`.
- Place token and Bootstrap variable changes in `app/styles/_theme-tokens.scss`.

Theme color policy for all pages/components:

1. Primary: `--color-primary` (`Button variant="primary"`, key brand actions).
2. Secondary: `--color-secondary` (`Button variant="success"`, positive status/confirmations).
3. Tertiary: `--color-tertiary` (`Button variant="info"`, planning/highlight accents).

When adding new UI code:

1. Use semantic tokens (`--color-primary`, `--color-secondary`, `--color-tertiary`, plus `--color-kicker-*` and `--color-link-*` semantic variants) instead of hardcoded hex values.
2. Prefer Bootstrap semantic variants (`primary`, `success`, `info`) so components stay synced with theme tokens.
3. Do not introduce new usage of legacy tokens like `--color-emerald` or `--color-cyan`; they are compatibility aliases.

## 5) Migration Strategy (Existing Sass Modules)

Migrate page-by-page, not all at once.

1. Keep current `*.module.scss` files and route layouts in place.
2. Replace common primitives first:
   - form wrappers -> `Form`, `Form.Group`, `Form.Control`
   - primary/secondary buttons -> `Button`
   - cards/panels -> `Card`
   - grid layouts -> `Container`, `Row`, `Col`
3. Keep business logic and API calls unchanged; only change view layer markup/styles.
4. Remove duplicated module styles only after each migrated screen is visually validated.
5. Keep theme variables in `app/styles/_theme-tokens.scss`; avoid hardcoded color values in component-level CSS.
6. Keep folder placement aligned with `docs/FOLDER_STRUCTURE_CONVENTIONS.md`.

## 6) What Not to Migrate

- Do not migrate auth/session logic (`app/api`, `lib/auth.ts`) as part of UI migration.
- Do not block feature work on full visual rewrite. Prefer incremental adoption.

## 7) Recommended Rollout Order

1. Marketing page (`/`)
2. Auth screens (`/login`, `/signup`)
3. Protected dashboard pages (`/wallet`, `/monthly-overview`)

This reduces risk and keeps core app flows stable during migration.
