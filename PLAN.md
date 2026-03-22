# Rootline - Implementation Plan & Progress Tracker

> **Last Updated**: 2026-03-22
> **Status**: Phase 1 - In Progress

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Database Schema](#database-schema)
- [Directory Structure](#directory-structure)
- [Phase 1: Foundation](#phase-1-foundation)
- [Phase 2: Core Features](#phase-2-core-features)
- [Phase 3: Collaboration](#phase-3-collaboration)
- [Phase 4: Polish](#phase-4-polish)
- [Dependencies](#dependencies)
- [Environment Variables](#environment-variables)
- [Additional Considerations](#additional-considerations)
- [Verification Checklists](#verification-checklists)

---

## Overview

**Rootline** is a family lineage tracking application that enables families to collaboratively build and explore their family trees. Key capabilities:

- Interactive tree visualization with pan/zoom/search
- Invite system with permission-scoped editing (owners, editors, viewers)
- Path highlighting between any two members with relationship labels ("2nd cousin once removed")
- Photo management (profiles + family photos)
- Version history with audit log and rollback
- GEDCOM import/export (standard genealogy format)
- Tree export as PNG/PDF
- Real-time notifications when members update the tree
- Light/dark mode, mobile-friendly, SEO optimized

---

## Architecture

### Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 16.2.1 (App Router) | React 19, TypeScript strict |
| Runtime/PM | Bun | Fast builds, native TypeScript |
| Auth | Clerk (`@clerk/nextjs`) | Handles sign-up/in, sessions, middleware |
| Database | Supabase (Postgres) | RLS policies, triggers, functions |
| Storage | Supabase Storage | Photo uploads, bucket: `tree-photos` |
| Real-time | Supabase Realtime | Live tree updates + notifications |
| Tree Viz | `@xyflow/react` v12 + `@dagrejs/dagre` | Interactive node graph + hierarchical layout |
| UI | shadcn/ui + Tailwind CSS v4 | Copy-paste components, full customization |
| Forms | react-hook-form + zod | Type-safe validation |
| Theming | next-themes | Light/dark + system preference |
| Icons | lucide-react | Pairs with shadcn/ui |
| Toasts | sonner | Lightweight notifications |
| Dates | date-fns | Tree-shakeable |
| Image Export | html-to-image | Canvas capture |
| Testing | vitest + @testing-library/react | Unit + integration |
| Deployment | Vercel | Edge runtime, ISR |
| License | BSL 1.1 | Source-visible, not permissive |

### Auth Architecture: Clerk + Supabase

Clerk handles all authentication. Supabase handles data/storage only (no Supabase Auth).

1. **Clerk Middleware** (`src/middleware.ts`) — protects routes, refreshes sessions
2. **Clerk Webhook** (`src/app/api/webhooks/clerk/route.ts`) — syncs user creation/updates to `profiles` table
3. **Server actions** — call `auth()` from Clerk to get userId, then query Supabase with service-role client
4. **RLS policies** — use `requesting_user_id()` function that reads `current_setting('app.current_user_id')`, set via `SET LOCAL` before each query

---

## Database Schema

### Tables

| # | Table | Purpose | Primary Key |
|---|-------|---------|-------------|
| 1 | `profiles` | Synced from Clerk webhook | `clerk_id TEXT` |
| 2 | `family_trees` | Tree metadata | `id UUID` |
| 3 | `tree_members` | People nodes in tree | `id UUID` |
| 4 | `relationships` | Edges between members | `id UUID` |
| 5 | `tree_memberships` | Account-to-tree access/roles | `id UUID` |
| 6 | `invitations` | Invite codes with expiry | `id UUID` |
| 7 | `audit_log` | Change tracking (auto via triggers) | `id UUID` |
| 8 | `media` | Photos linked to members/trees | `id UUID` |
| 9 | `tree_snapshots` | Full tree state for rollback | `id UUID` |
| 10 | `notifications` | In-app notifications | `id UUID` |

### Key Fields

**profiles**: clerk_id, display_name, avatar_url, email, created_at, updated_at

**family_trees**: id, name, description, owner_id (refs profiles.clerk_id), is_public, created_at, updated_at

**tree_members**: id, tree_id, first_name, last_name, maiden_name, gender (male|female|other|unknown), date_of_birth, date_of_death, birth_place, death_place, bio, avatar_url, is_deceased, position_x, position_y, created_at, updated_at, created_by

**relationships**: id, tree_id, from_member_id, to_member_id, relationship_type (parent_child|spouse|divorced|adopted), start_date, end_date, created_at. UNIQUE(tree_id, from_member_id, to_member_id, relationship_type)

**tree_memberships**: id, tree_id, user_id (refs profiles.clerk_id), role (owner|editor|viewer), linked_node_id (refs tree_members), joined_at. UNIQUE(tree_id, user_id)

**invitations**: id, tree_id, invite_code (UNIQUE), created_by, target_node_id, email, role (editor|viewer), max_uses, use_count, expires_at, created_at

**audit_log**: id, tree_id, user_id, action, entity_type, entity_id, old_data JSONB, new_data JSONB, created_at

**media**: id, tree_id, uploaded_by, storage_path, file_name, file_size, mime_type, member_id, is_profile_photo, caption, created_at

**tree_snapshots**: id, tree_id, created_by, snapshot_data JSONB, description, created_at

**notifications**: id, tree_id, user_id, type, message, entity_id, is_read, created_at

### Critical Functions

1. **`is_descendant_of(tree_id, node_id, ancestor_id)`** — Recursive CTE to check descendant relationships. Used for editor permission scoping.
2. **`requesting_user_id()`** — Reads `current_setting('app.current_user_id')` for RLS. Set via `SET LOCAL` in server actions.

### RLS Policy Strategy
- **Profiles**: read any, update own
- **Family Trees**: read if member or public, write if owner
- **Tree Members/Relationships**: read if tree member, write if owner OR editor with descendant scope
- **Invitations**: read/create by owner only
- **Audit Log**: read by tree members, auto-inserted via triggers
- **Media**: read by tree member, write by scoped editors
- **Notifications**: read/update own only

---

## Directory Structure

```
rootline/
├── PLAN.md                    # This file
├── README.md                  # Project README
├── LICENSE                    # BSL 1.1
├── CLAUDE.md                  # AI assistant instructions
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── components.json            # shadcn/ui config
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_functions.sql
│   │   ├── 003_rls_policies.sql
│   │   └── 004_triggers.sql
│   └── seed.sql
└── src/
    ├── middleware.ts                          # Clerk middleware
    ├── app/
    │   ├── layout.tsx                        # Root: ClerkProvider + ThemeProvider
    │   ├── globals.css                       # Brand tokens + dark mode
    │   ├── (marketing)/
    │   │   ├── page.tsx                      # Landing page
    │   │   └── layout.tsx
    │   ├── (auth)/
    │   │   ├── sign-in/[[...sign-in]]/page.tsx
    │   │   ├── sign-up/[[...sign-up]]/page.tsx
    │   │   └── layout.tsx
    │   ├── (dashboard)/
    │   │   ├── dashboard/page.tsx
    │   │   └── layout.tsx
    │   ├── tree/[id]/
    │   │   ├── page.tsx                      # Tree canvas view
    │   │   ├── settings/page.tsx
    │   │   ├── history/page.tsx
    │   │   ├── member/[memberId]/page.tsx
    │   │   └── layout.tsx
    │   ├── invite/[code]/page.tsx
    │   ├── profile/page.tsx
    │   └── api/webhooks/clerk/route.ts
    ├── components/
    │   ├── ui/                               # shadcn/ui components
    │   ├── tree/                             # Tree visualization
    │   ├── dashboard/                        # Dashboard components
    │   ├── invite/                           # Invite system
    │   ├── history/                          # Audit/version UI
    │   ├── photos/                           # Photo management
    │   ├── notifications/                    # Notification bell/list
    │   ├── import-export/                    # GEDCOM + image export
    │   ├── layout/                           # Header, footer, nav
    │   ├── shared/                           # Loading, error, empty states
    │   └── auth/                             # Auth-related components
    ├── lib/
    │   ├── supabase/
    │   │   ├── client.ts                     # Browser client (anon key)
    │   │   ├── server.ts                     # Server client (service role + RLS)
    │   │   └── admin.ts                      # Admin client (no RLS)
    │   ├── actions/
    │   │   ├── tree.ts
    │   │   ├── member.ts
    │   │   ├── relationship.ts
    │   │   ├── invite.ts
    │   │   ├── photo.ts
    │   │   ├── profile.ts
    │   │   ├── audit.ts
    │   │   └── notification.ts
    │   ├── utils/
    │   │   ├── tree-layout.ts                # Dagre → React Flow positions
    │   │   ├── path-finder.ts                # BFS shortest path
    │   │   ├── relationship-calculator.ts    # "2nd cousin once removed"
    │   │   ├── gedcom-parser.ts              # GEDCOM → tree data
    │   │   ├── gedcom-exporter.ts            # Tree data → GEDCOM
    │   │   ├── cn.ts                         # clsx + tailwind-merge
    │   │   └── date.ts                       # Date formatting
    │   ├── hooks/
    │   │   ├── use-tree-permissions.ts
    │   │   ├── use-tree-data.ts
    │   │   ├── use-realtime-tree.ts
    │   │   ├── use-notifications.ts
    │   │   └── use-debounce.ts
    │   └── validators/
    │       ├── tree.ts
    │       ├── member.ts
    │       ├── relationship.ts
    │       └── invite.ts
    └── types/
        ├── database.ts                       # Generated from Supabase
        ├── tree.ts
        ├── member.ts
        ├── relationship.ts
        └── index.ts
```

---

## Phase 1: Foundation

**Goal**: App skeleton with auth, theme, layouts, database, and core types. User can sign up, log in, see an empty dashboard.

### Stream 1: Infrastructure & Setup
**Status**: 🔄 IN PROGRESS
- [x] Install production dependencies
- [x] Install dev dependencies
- [x] Create directory structure
- [ ] Create `.env.local` template
- [ ] Create Supabase client files (client.ts, server.ts, admin.ts)
- [ ] Create database migration files (4 files)
- [ ] Configure `next.config.ts`
- [ ] Set up shadcn/ui (components.json, cn utility, base components)
- [ ] Create `vitest.config.ts`
- [ ] Create LICENSE (BSL 1.1)
- [ ] Create README.md
- [ ] Update CLAUDE.md

### Stream 2: UI Foundation & Design System
**Status**: ⏳ PENDING (blocked by Stream 1)
- [ ] Update `globals.css` with brand color tokens (warm earth tones)
- [ ] Configure `next-themes` ThemeProvider + theme-toggle
- [ ] Create layout components (header, footer, sidebar, mobile-nav, user-menu)
- [ ] Create route group layouts (marketing, auth, dashboard, tree)
- [ ] Create shared components (loading-skeleton, error-boundary, empty-state, confirm-dialog)
- [ ] Update root layout: ClerkProvider, ThemeProvider, Toaster, metadata

### Stream 3: Authentication (Clerk)
**Status**: ⏳ PENDING (blocked by Stream 1)
- [ ] Create `src/middleware.ts` with Clerk route protection
- [ ] Create sign-in page (`/sign-in`)
- [ ] Create sign-up page (`/sign-up`)
- [ ] Create Clerk webhook endpoint for profile sync
- [ ] Create profile page
- [ ] Set Clerk environment variables

### Stream 4: Core Data Layer
**Status**: ⏳ PENDING (blocked by Stream 1)
- [ ] Create app-level TypeScript types
- [ ] Create Zod validation schemas
- [ ] Create server actions (tree, member, relationship CRUD)
- [ ] Create `tree-layout.ts` (dagre computation)
- [ ] Create `path-finder.ts` (BFS)
- [ ] Create `relationship-calculator.ts` (LCA-based)
- [ ] Write unit tests for utils + validators

---

## Phase 2: Core Features

**Goal**: Users can create trees, add members/relationships, and interact with the visual tree.

### Stream 5: Tree Visualization
**Status**: ⏳ NOT STARTED
- [ ] `tree-canvas.tsx` — React Flow wrapper (pan/zoom/minimap)
- [ ] `member-node.tsx` — Custom node (avatar, name, dates, deceased styling)
- [ ] `relationship-edge.tsx` — Custom edges (solid/dashed/dotted, green highlight)
- [ ] `path-highlighter.tsx` — BFS path + green highlight + relationship label
- [ ] `tree-toolbar.tsx` — Zoom, fit, add member, search, export
- [ ] `tree-search.tsx` — Cmd+K command palette
- [ ] `member-detail-panel.tsx` — Side panel / bottom sheet
- [ ] `add-member-dialog.tsx` + `add-relationship-dialog.tsx`
- [ ] Tree page (`/tree/[id]`)
- [ ] Mobile optimizations (touch, responsive panels)

### Stream 6: Dashboard & Tree Management
**Status**: ⏳ NOT STARTED
- [ ] Dashboard page (`/dashboard`) — tree card grid
- [ ] `create-tree-dialog.tsx` — new tree form
- [ ] Tree settings page (`/tree/[id]/settings`)
- [ ] Member detail page (`/tree/[id]/member/[memberId]`)

---

## Phase 3: Collaboration

**Goal**: Multi-user collaboration with invites, permissions, photos, and real-time notifications.

### Stream 7: Invite & Permission System
**Status**: ⏳ NOT STARTED
- [ ] `invite-form.tsx` — owner creates invite
- [ ] `invite-list.tsx` — manage active invites
- [ ] Invite acceptance page (`/invite/[code]`)
- [ ] `use-tree-permissions.ts` hook
- [ ] Self-assignment to unlinked nodes
- [ ] Server-side permission checks

### Stream 8: Photo Management
**Status**: ⏳ NOT STARTED
- [ ] `photo-upload.tsx` — drag-and-drop + compression
- [ ] `avatar-upload.tsx` — circular crop
- [ ] `photo-gallery.tsx` — grid + lightbox
- [ ] Photo server actions
- [ ] Next.js Image optimization

### Stream 9: Real-time Notifications
**Status**: ⏳ NOT STARTED
- [ ] Notification database triggers
- [ ] `use-realtime-tree.ts` — live tree refresh
- [ ] `use-notifications.ts` — notification subscription
- [ ] `notification-bell.tsx` — header bell + dropdown
- [ ] Notification server actions

---

## Phase 4: Polish

**Goal**: Version history, GEDCOM support, tree image export, polished landing page, full test coverage.

### Stream 10: Version Control & Audit Log
**Status**: ⏳ NOT STARTED
- [ ] Audit server actions (createSnapshot, getAuditLog, rollback)
- [ ] History page (`/tree/[id]/history`)
- [ ] `snapshot-viewer.tsx`
- [ ] `rollback-dialog.tsx`

### Stream 11: GEDCOM Import/Export
**Status**: ⏳ NOT STARTED
- [ ] `gedcom-parser.ts` — GEDCOM 5.5.1 → tree data
- [ ] `gedcom-exporter.ts` — tree data → GEDCOM
- [ ] `gedcom-import-dialog.tsx`
- [ ] `gedcom-export-button.tsx`

### Stream 12: Tree Image Export
**Status**: ⏳ NOT STARTED
- [ ] `tree-image-export.tsx` — html-to-image capture
- [ ] PNG + PDF export
- [ ] Toolbar integration

### Stream 13: Landing Page & SEO
**Status**: ⏳ NOT STARTED
- [ ] Hero section + CTA
- [ ] Feature showcase
- [ ] How it works
- [ ] SEO: metadata, Open Graph, JSON-LD, sitemap

### Stream 14: Testing
**Status**: ⏳ NOT STARTED (tests written per-phase, final sweep here)
- [ ] vitest config
- [ ] Unit tests: tree-layout, path-finder, relationship-calculator, GEDCOM parser/exporter, validators
- [ ] Integration tests: server actions
- [ ] E2E: Playwright (future)

---

## Dependencies

### Production
```
@clerk/nextjs, svix, @supabase/supabase-js, @xyflow/react, @dagrejs/dagre,
react-hook-form, @hookform/resolvers, zod, clsx, tailwind-merge, date-fns,
lucide-react, sonner, next-themes, html-to-image
```

### Development
```
vitest, @testing-library/react, @testing-library/jest-dom, jsdom, @types/dagre
```

### shadcn/ui Components
```
button, input, label, card, dialog, dropdown-menu, avatar, badge, skeleton,
sheet, command, separator, tooltip, select, textarea, popover, calendar, checkbox
```

---

## Environment Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Additional Considerations

| Feature | Status | Notes |
|---------|--------|-------|
| Search within tree | Phase 2 | Cmd+K command palette |
| Deceased member handling | Phase 2 | Grayscale + icon in node |
| Collapse/expand subtrees | Phase 2 | Performance for large trees |
| Relationship calculator | Phase 2 | LCA algorithm |
| GEDCOM import/export | Phase 4 | Standard genealogy format |
| Tree image export | Phase 4 | PNG/PDF |
| In-app notifications | Phase 3 | Supabase Realtime |
| Data privacy / GDPR | Ongoing | Cascade deletes, export |
| Accessibility | Ongoing | ARIA, keyboard nav, contrast |
| Rate limiting | Phase 3 | Server action checks |
| Tree merging | Future | Complex, schema supports it |
| Offline viewing | Future | Service worker + IndexedDB |

---

## Verification Checklists

### After Phase 1
- [ ] `bun run build` succeeds
- [ ] Sign up via Clerk, verify profile synced to Supabase
- [ ] Log in, see empty dashboard
- [ ] Toggle dark mode
- [ ] Unauthenticated users redirected to sign-in

### After Phase 2
- [ ] Create a tree from dashboard
- [ ] Add 5+ members with relationships
- [ ] Pan/zoom tree, click nodes for detail panel
- [ ] Select two nodes, verify green path + relationship label
- [ ] Search members via Cmd+K
- [ ] Edit/delete members
- [ ] Mobile viewport: verify responsive layout

### After Phase 3
- [ ] Create invite link, open in incognito, sign up, accept
- [ ] As invited editor: add children below linked node (succeeds), try editing above (fails)
- [ ] Upload profile photo and family photos
- [ ] See real-time notification when another user edits the tree
- [ ] Self-assign to an unlinked node

### After Phase 4
- [ ] View audit log timeline on history page
- [ ] Create snapshot, make changes, rollback, verify state restored
- [ ] Import a GEDCOM file, verify tree populated correctly
- [ ] Export tree as GEDCOM, verify valid format
- [ ] Export tree as PNG image
- [ ] Landing page loads fast, SEO meta tags present
- [ ] `bun run lint` passes
- [ ] `bun test` passes all unit/integration tests
