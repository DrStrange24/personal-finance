# Folder Structure Conventions

This document defines how to organize code and docs as the project grows.

## Objectives

- Keep navigation predictable.
- Keep related files close to each other.
- Prevent style, component, and docs sprawl.

## Canonical Structure

```text
app/
  (app)/
  (auth)/
  api/
  styles/
    _theme-tokens.scss
    _base.scss
    _components.scss
  globals.scss
  layout.tsx
  page.tsx
lib/
prisma/
public/
docs/
```

## Routing and Pages

- Route files (`page.tsx`, `layout.tsx`) stay in `app/` route segments.
- Keep route-only code in the same segment folder.
- Shared route UI can be extracted to `app/components/` when duplication appears.
- Server Components are the default for loading page data.
- Client Components should use `fetch` to `app/api/*` for browser-triggered operations.
- Do not import Prisma client into browser/client components.

## API and Data Access

- `app/api/`: request validation, auth/session checks, mutations, and endpoints consumed by client-side UI/external callers.
- `lib/`: shared utilities; database access helpers should be server-only.
- Prisma access must stay server-side (Server Components, API handlers, server-only modules).

## Components

- Use `app/components/` for reusable UI used by multiple routes.
- Prefer feature groupings when the folder grows:
  - `app/components/navigation/`
  - `app/components/forms/`
  - `app/components/finance/`
- Reusable confirmation controls for destructive actions should live in `app/components/` and use `confirmation-modal.tsx`.

## UX Safety Convention

- Always require an explicit confirmation modal for any delete/archive/removal action before the mutation is submitted.
- Apply this consistently in every module/route.
- For create/edit/save forms inside modals, close the modal when submit completes.

## Styles (SCSS)

- Global entrypoint:
  - `app/globals.scss`
- Global style partials:
  - `app/styles/_theme-tokens.scss`: CSS variables + Bootstrap variable mapping.
  - `app/styles/_base.scss`: reset, typography, and base HTML/body styles.
  - `app/styles/_components.scss`: shared global utility/component classes.
- Route/component-specific styles:
  - co-located `*.module.scss`.

## Docs

- `docs/PROJECT_STRUCTURE.md`: current tree and what each area contains.
- `docs/ARCHITECTURE.md`: high-level technical architecture.
- `docs/DEVELOPMENT_GUIDE.md`: setup and day-to-day developer workflow.
- `docs/FRONTEND_REACT_BOOTSTRAP.md`: frontend component/theming usage.
- `docs/FOLDER_STRUCTURE_CONVENTIONS.md`: folder rules and placement policy.

## Change Checklist (AI + Human)

When adding a new file or folder:

1. Put it in the canonical location.
2. Confirm no existing folder already fits.
3. Update `docs/PROJECT_STRUCTURE.md` if structure changed.
4. Update relevant docs if behavior/workflow changed.
5. Keep naming consistent and feature-oriented.
