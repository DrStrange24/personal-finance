# AI Collaboration Rules

This file defines mandatory folder-structure rules for AI-assisted changes in this repository.

## Core Rule

- Do not place files in ad-hoc locations.
- Reuse existing folders first.
- If a new folder is required, document it in `docs/PROJECT_STRUCTURE.md` in the same change.

## Folder Contract

- `app/`: App Router routes, layouts, and route-specific UI.
- `app/api/`: Route handlers only.
- `app/styles/`: Global style system (tokens, base, shared component styles).
- `app/*.module.scss`: Route/component-local styles only.
- `lib/`: Shared server/client utilities.
- `prisma/`: Prisma schema and migrations.
- `docs/`: Architecture, workflows, and conventions.
- `public/`: Static assets.

## UI Code Placement

- Route-specific components stay inside their route segment folder.
- Reusable UI should be placed in `app/components/` (create when first needed).
- Avoid duplicating UI patterns across pages; extract shared components.

## SCSS Placement

- `app/globals.scss` is the global entrypoint imported by `app/layout.tsx`.
- Keep global style logic split under `app/styles/`:
  - `_theme-tokens.scss`
  - `_base.scss`
  - `_components.scss`
- Add new global tokens only in `_theme-tokens.scss`.
- Keep page-specific styling in co-located `*.module.scss`.

## Documentation Updates (Required)

When adding or moving files/folders:

1. Update `docs/PROJECT_STRUCTURE.md`.
2. Update any affected workflow docs (`README.md`, `docs/DEVELOPMENT_GUIDE.md`, or feature docs).
3. If conventions change, update `docs/FOLDER_STRUCTURE_CONVENTIONS.md`.

## Naming Rules

- Use kebab-case for filenames and folders unless framework conventions require otherwise.
- Use clear, feature-oriented names (`monthly-overview`, `theme-toggle`, `auth`).
- Do not use generic folder names like `misc`, `temp`, `new`, or `stuff`.
