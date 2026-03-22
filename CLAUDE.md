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
