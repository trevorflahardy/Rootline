# Lineage Tracker

## Project Overview

A Next.js application for lineage tracking.

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Runtime:** Bun
- **Styling:** Tailwind CSS v4
- **Backend:** Supabase (auth, database, storage)
- **Deployment:** Vercel
- **Package Manager:** Bun

## Project Structure

```
src/
  app/          # Next.js App Router pages and layouts
  components/   # Reusable React components
  lib/          # Utility functions and shared logic
  types/        # TypeScript type definitions
```

## Commands

- `bun dev` — Start development server (Turbopack)
- `bun run build` — Production build
- `bun run lint` — Run ESLint
- `bun test` — Run tests

## Conventions

- Use `src/` directory for all application code
- Use `@/*` import alias for absolute imports from `src/`
- Prefer server components by default; add `"use client"` only when needed
- Environment variables: use `.env.local` for local dev (never commit)
- Supabase client setup goes in `src/lib/supabase/`
- Use `next/image` `<Image>` instead of `<img>` for all images (remote patterns configured in `next.config.ts`)
- Auth is handled by Clerk (webhooks sync to Supabase `profiles` table)

## Quality Standards

Before completing any feature or change, always run and pass the following checks:

1. **Type checking:** `bunx tsc --noEmit` — must have zero errors
2. **Linting:** `bun run lint` — must have zero errors (warnings from third-party library incompatibilities like React Hook Form are acceptable)
3. **Tests:** `bun test` — all tests must pass
4. **Build:** `bun run build` — must complete successfully

### Testing Requirements

- Write meaningful tests for new server actions and utility functions
- Frontend components that contain logic (not just presentation) should have tests
- Tests go in `__tests__/` directories colocated with the code they test, or in a top-level `tests/` directory
- Use descriptive test names that explain the expected behavior

### Code Quality Rules

- Remove unused imports and variables — do not leave dead code
- Escape special characters in JSX text (`&apos;` not `'`)
- Avoid `setState` directly inside `useEffect` bodies — use `useSyncExternalStore` for mount detection
- Prefer `catch` without binding the error variable if unused (use `catch {` not `catch (error) {`)
- Do not commit code that introduces new lint errors
