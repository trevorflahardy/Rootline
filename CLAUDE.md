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

## Glassmorphism Design System

Rootline uses a **modern glassmorphism** visual language. All UI components must follow the design tokens and patterns defined in the `/rootline-glassmorphism` skill (`.claude/skills/rootline-glassmorphism/SKILL.md`).

### Key Principles

- **Glass surfaces**: Use `glass-card`, `glass-heavy`, `glass-light`, `glass-elevated` Tailwind utilities — never manually write `backdrop-filter` or rgba backgrounds inline
- **Neutral glass, colored content**: Glass surfaces are gray/white translucent. Brand primary color appears only in content (buttons, active nav items, progress bars, links), never in the glass itself
- **Gradient backgrounds**: Pages use subtle warm gradients (`gray-100 via gray-50 to stone-100` light, `gray-950 via gray-900 to stone-950` dark) that show through the glass blur
- **Edge highlights**: Use `glass-edge-top` and `glass-edge-left` utilities for the characteristic refraction effect on glass panels
- **Tree Health metric**: Sidebar displays a tree completeness percentage with progress bar — defined in the skill file
- **Dark mode**: Glass tokens auto-adjust via CSS custom properties — always test both modes
- **Max 2 blur layers**: Never nest more than 2 `backdrop-filter` elements for performance

### When Modifying the Design System

If the user requests changes to the glassmorphism styling (new tokens, color changes, component patterns):

1. Update `.claude/skills/rootline-glassmorphism/SKILL.md` first (source of truth)
2. Update `globals.css` tokens if CSS values changed
3. Update this section of CLAUDE.md if conventions changed
4. Invoke `/rootline-glassmorphism` skill in future sessions to load the latest spec

### Required Skills for UI Work

When building or modifying any visual component, always invoke:
- `/rootline-glassmorphism` — project-specific glass tokens and component recipes
- `/ui-ux-pro-max` — general design intelligence (styles, palettes, UX guidelines)
- `/frontend-design` — production-grade frontend patterns (when building new pages)

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
