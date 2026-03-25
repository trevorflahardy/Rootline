# Rootline - Implementation Plan & Progress Tracker

> **Last Updated**: 2026-03-23
> **Status**: Phases 1–5.5 Complete (332 tests passing, glassmorphism redesign applied)

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
- [Phase 5: Advanced Relationships & Permissions](#phase-5-advanced-relationships--permissions)
- [Phase 5.5: Glassmorphism UI Redesign](#phase-55-glassmorphism-ui-redesign)
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

| Layer        | Technology                             | Notes                                        |
| ------------ | -------------------------------------- | -------------------------------------------- |
| Framework    | Next.js 16.2.1 (App Router)            | React 19, TypeScript strict                  |
| Runtime/PM   | Bun                                    | Fast builds, native TypeScript               |
| Auth         | Clerk (`@clerk/nextjs`)                | Handles sign-up/in, sessions, middleware     |
| Database     | Supabase (Postgres)                    | RLS policies, triggers, functions            |
| Storage      | Supabase Storage                       | Photo uploads, bucket: `tree-photos`         |
| Real-time    | Supabase Realtime                      | Live tree updates + notifications            |
| Tree Viz     | `@xyflow/react` v12 + `@dagrejs/dagre` | Interactive node graph + hierarchical layout |
| UI           | shadcn/ui + Tailwind CSS v4            | Copy-paste components, full customization    |
| Forms        | react-hook-form + zod                  | Type-safe validation                         |
| Theming      | next-themes                            | Light/dark + system preference               |
| Icons        | lucide-react                           | Pairs with shadcn/ui                         |
| Toasts       | sonner                                 | Lightweight notifications                    |
| Dates        | date-fns                               | Tree-shakeable                               |
| Image Export | html-to-image                          | Canvas capture                               |
| Testing      | vitest + @testing-library/react        | Unit + integration                           |
| Deployment   | Vercel                                 | Edge runtime, ISR                            |
| License      | —                                      | Public source, no license yet                |

### Auth Architecture: Clerk + Supabase

Clerk handles all authentication. Supabase handles data/storage only (no Supabase Auth).

1. **Clerk Proxy** (`src/proxy.ts`) — protects routes, refreshes sessions (renamed from middleware.ts for Next.js 16)
2. **Clerk Webhook** (`src/app/api/webhooks/clerk/route.ts`) — syncs user creation/updates to `profiles` table
3. **Server actions** — call `auth()` from Clerk to get userId, then query Supabase with service-role client
4. **RLS policies** — use `requesting_user_id()` function that reads `current_setting('app.current_user_id')`, set via `SET LOCAL` before each query

---

## Database Schema

### Tables

| #   | Table              | Purpose                             | Primary Key     |
| --- | ------------------ | ----------------------------------- | --------------- |
| 1   | `profiles`         | Synced from Clerk webhook           | `clerk_id TEXT` |
| 2   | `family_trees`     | Tree metadata                       | `id UUID`       |
| 3   | `tree_members`     | People nodes in tree                | `id UUID`       |
| 4   | `relationships`    | Edges between members               | `id UUID`       |
| 5   | `tree_memberships` | Account-to-tree access/roles        | `id UUID`       |
| 6   | `invitations`      | Invite codes with expiry            | `id UUID`       |
| 7   | `audit_log`        | Change tracking (auto via triggers) | `id UUID`       |
| 8   | `media`            | Photos linked to members/trees      | `id UUID`       |
| 9   | `tree_snapshots`   | Full tree state for rollback        | `id UUID`       |
| 10  | `notifications`    | In-app notifications                | `id UUID`       |

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

**Status**: ✅ COMPLETE

- [x] Install production dependencies
- [x] Install dev dependencies
- [x] Create directory structure
- [x] Create `.env.example` template
- [x] Create Supabase client files (client.ts, server.ts, admin.ts)
- [x] Create database migration files (4 files)
- [x] Configure `next.config.ts`
- [x] Set up shadcn/ui (components.json, cn utility, base components)
- [x] Create `vitest.config.ts`
- [x] Create README.md
- [x] Update CLAUDE.md

### Stream 2: UI Foundation & Design System

**Status**: ✅ COMPLETE

- [x] Update `globals.css` with brand color tokens (warm earth tones, oklch)
- [x] Configure `next-themes` ThemeProvider via Providers component
- [x] Create layout components (header, footer, theme-toggle, user-menu)
- [x] Create route group layouts (marketing, auth, dashboard, tree)
- [x] Create shared components (loading-skeleton, empty-state, confirm-dialog)
- [x] Update root layout: ClerkProvider, Providers wrapper, Toaster, metadata

### Stream 3: Authentication (Clerk)

**Status**: ✅ COMPLETE

- [x] Create `src/proxy.ts` with Clerk route protection (Next.js 16 proxy convention)
- [x] Create sign-in page (`/sign-in`)
- [x] Create sign-up page (`/sign-up`)
- [x] Create Clerk webhook endpoint for profile sync
- [x] Create profile page
- [x] Create `getAuthUser()` helper with auto profile sync

### Stream 4: Core Data Layer

**Status**: ✅ COMPLETE

- [x] Create app-level TypeScript types
- [x] Create Zod validation schemas (zod/v4)
- [x] Create server actions (tree, member, relationship CRUD)
- [x] Create `tree-layout.ts` (dagre computation)
- [x] Create `path-finder.ts` (BFS)
- [x] Create `relationship-calculator.ts` (LCA-based)
- [x] Write unit tests for utils + validators (42 tests passing)

---

## Phase 2: Core Features

**Goal**: Users can create trees, add members/relationships, and interact with the visual tree.

### Stream 5: Tree Visualization

**Status**: ✅ COMPLETE

- [x] `tree-canvas.tsx` — React Flow wrapper (pan/zoom/minimap, smooth refresh)
- [x] `member-node.tsx` — Custom node (avatar, name, dates, deceased styling)
- [x] `relationship-edge.tsx` — Custom edges (solid/dashed/dotted, green highlight)
- [x] Path highlighting — Shift-click two nodes → green path + relationship label
- [x] `tree-toolbar.tsx` — Zoom, fit, add member, search, export
- [x] `tree-search.tsx` — Cmd+K command palette with avatars
- [x] `member-detail-panel.tsx` — Side panel with family links
- [x] `add-member-dialog.tsx` — Searchable member combobox with avatars
- [x] `edit-member-dialog.tsx` — Edit member form
- [x] `empty-tree-state.tsx` — Empty tree CTA
- [x] Tree page (`/tree/[id]`) with server data fetching

### Stream 6: Dashboard & Tree Management

**Status**: ✅ COMPLETE

- [x] Dashboard page (`/dashboard`) — tree card grid with Suspense
- [x] `dashboard-header.tsx` + `create-tree-dialog.tsx` — controlled dialog (no hydration issues)
- [x] Tree settings page (`/tree/[id]/settings`) — name, description, visibility, members, danger zone
- [x] Member detail page (`/tree/[id]/member/[memberId]`) — profile, family links, edit/delete
- [x] Landing page redesign — organic gradients, feature cards, how-it-works

---

## Phase 3: Collaboration

**Goal**: Multi-user collaboration with invites, permissions, photos, and real-time notifications.

### Stream 7: Invite & Permission System

**Status**: ✅ COMPLETE

- [x] Invite server actions (create, accept, list, revoke)
- [x] `invite-manager.tsx` — owner creates/manages invites with role + linked node scoping
- [x] `accept-invite-card.tsx` — invite acceptance UI (sign-in/up for unauthenticated)
- [x] Invite acceptance page (`/invite/[code]`) with expiry/usage validation
- [x] Integrated into tree settings page
- [x] Server-side permission checks (owner-only invite management)
- [x] Tests: invite validation (10 tests) + permission scoping (9 tests)

### Stream 8: Photo Management

**Status**: ✅ COMPLETE

- [x] `photo-upload.tsx` — drag-and-drop + preview + file validation (5MB, JPEG/PNG/WebP/GIF)
- [x] `photo-gallery.tsx` — grid + lightbox + delete
- [x] Photo server actions (upload, list, delete, profile photo management)
- [x] Supabase Storage integration (tree-photos bucket)
- [x] Profile photo auto-sets member avatar_url

### Stream 9: Real-time Notifications

**Status**: ✅ COMPLETE

- [x] Notification server actions (list, unread count, mark read, mark all read)
- [x] `notification-bell.tsx` — header bell with unread badge + popover dropdown
- [x] Polling-based refresh (30s interval)
- [x] Notification triggers already in database (004_triggers.sql)

---

## Phase 4: Polish

**Goal**: Version history, GEDCOM support, tree image export, polished landing page, full test coverage.

### Stream 10: Version Control & Audit Log

**Status**: ✅ COMPLETE

- [x] Audit server actions (createSnapshot, getAuditLog, getSnapshots, rollbackToSnapshot)
- [x] History page (`/tree/[id]/history`) with server + client components
- [x] `audit-timeline.tsx` — timeline with action badges and change summaries
- [x] `snapshot-viewer.tsx` — snapshot cards with member/relationship counts
- [x] `rollback-dialog.tsx` — confirmation dialog with data loss warning
- [x] `history-client.tsx` — client wrapper for pagination, snapshot creation, rollback

### Stream 11: GEDCOM Import/Export

**Status**: ✅ COMPLETE

- [x] `gedcom-parser.ts` — GEDCOM 5.5.1 → tree data (handles date formats, name variants, maiden names)
- [x] `gedcom-exporter.ts` — tree data → GEDCOM 5.5.1 (INDI, FAM, HEAD, TRLR records)
- [x] `gedcom-import-dialog.tsx` — file upload, preview, confirm import
- [x] `gedcom-export-button.tsx` — fetch + download .ged file
- [x] `import.ts` server action — bulk-create members + relationships from parsed GEDCOM
- [x] Toolbar integration (import + export buttons)
- [x] Tests: 27 tests (15 parser + 12 exporter)

### Stream 12: Tree Image Export

**Status**: ✅ COMPLETE

- [x] `tree-image-export.tsx` — html-to-image capture with 2x pixel ratio
- [x] PNG + SVG export (auto-download)
- [x] Print/PDF export (opens print dialog with tree image)
- [x] Toolbar integration (dropdown menu with format options)
- [x] Excludes minimap, toolbar, overlays from capture via `data-export-exclude`

### Stream 13: Landing Page & SEO

**Status**: ✅ COMPLETE

- [x] Hero section + CTA (completed in Phase 2)
- [x] Feature showcase + How it works (completed in Phase 2)
- [x] Root layout metadata: Open Graph, Twitter Card, keywords, authors
- [x] Marketing layout: JSON-LD `WebApplication` structured data
- [x] `sitemap.ts` — Next.js sitemap route
- [x] `robots.ts` — Next.js robots route (disallows /dashboard, /tree, /api)
- [x] `opengraph-image.tsx` — dynamic OG image (1200×630) with brand gradient

### Stream 14: Testing

**Status**: ✅ COMPLETE (83 → 207 tests across 18 files)

- [x] vitest config verified
- [x] Unit tests: tree-layout, path-finder, relationship-calculator, date utils, GEDCOM parser/exporter
- [x] Validator tests: tree, member, relationship, invite, profile schemas
- [x] Integration tests: server actions (tree, member, relationship, invite) with mocked Supabase
- [ ] E2E: Playwright (future)

### Bugfix: Permission Enforcement (2026-03-23)

- [x] Fixed `createRelationship` — editors with linked nodes now scoped to descendants only
- [x] Fixed `createInvite` — blocks inviting to nodes already linked to a user
- [x] Fixed client-side detail panel — per-member `canEditMember()` check instead of global `canEdit` boolean
- [x] Added permissions section to member detail panel (owner-editable, editor-visible, viewer-hidden)
- [x] New server actions: `getNodeMembership`, `updateMemberRole`, `updateMemberLinkedNode`
- [x] Fixed hydration mismatch — `suppressHydrationWarning` on Button component

---

## Phase 5: Advanced Relationships & Permissions

**Goal**: Horizontal relationship linking (in-laws, step-relations), enhanced permission management UI, and tree UX improvements.

### Stream 15: Horizontal Relationship Linking

**Status**: ✅ COMPLETE

Added 5 new relationship types (sibling, step_parent, step_child, in_law, guardian) with full stack support.

- [x] Extend `relationship_type` enum: add `sibling`, `step_parent`, `step_child`, `in_law`, `guardian` types
- [x] Database migration (`006_extended_relationships.sql`) — ALTER CHECK constraint on `relationships.relationship_type`
- [x] Update `relationship-calculator.ts` — handle new relationship types in path traversal and label generation
- [x] Update `createRelationshipSchema` validator — accept new relationship types
- [x] `add-relationship-dialog.tsx` — new dialog for linking two existing members with any relationship type (grouped: Hierarchical vs Horizontal)
- [x] Update `relationship-edge.tsx` — distinct visual styles for new edge types (unique dash patterns per type)
- [x] Update `tree-layout.ts` — step_parent/guardian create hierarchy; sibling/in_law horizontal; siblings same rank
- [x] Update `path-finder.ts` — BFS traversal includes new relationship types with correct directionality
- [x] Update GEDCOM parser/exporter to handle extended relationship types via custom tags (_SIBL, _STEP, _STEPC, _GUARD, _INLAW)
- [x] Tests: 25 new tests — relationship calculator, layout, path-finder, validator, GEDCOM round-trip

### Stream 16: Permission Management Dashboard

**Status**: ✅ COMPLETE

Full permission management UI with bulk operations and activity tracking.

- [x] `permission-manager.tsx` — table of all tree members with role, linked node, last active, activity indicators
- [x] Inline role editing (owner can change editor↔viewer via Select dropdown)
- [x] Inline linked node reassignment (owner can change which node a member is scoped to)
- [x] Bulk operations: revoke access, change roles for multiple members with confirmation dialogs
- [x] Activity indicators: green (<24h), yellow (<7d), gray (>7d) — owner row grayed out and non-editable
- [x] Integrate into tree settings page (`/tree/[id]/settings`) between form and invites
- [x] New server actions: `getTreeMembershipsWithActivity`, `revokeMembership`, `bulkUpdateRoles`, `bulkRevokeMemberships`
- [x] Tests: 18 new tests (9 server action + 9 component)

### Stream 17: Tree UX Improvements

**Status**: ✅ COMPLETE

Undo/redo, context menu, keyboard shortcuts, multi-select, and mobile support.

- [x] Multi-select nodes (shift+click) for bulk operations (delete selected). Path highlighting moved to Alt+click.
- [x] Undo/redo for tree edits (`use-undo-redo.ts` — action stack, max 50, with floating Undo/Redo buttons)
- [x] Keyboard shortcuts: Delete/Backspace to remove selected, Ctrl+Z undo, Ctrl+Shift+Z/Ctrl+Y redo, Escape to clear
- [x] Context menu (right-click) on nodes: edit, delete, add child, add spouse, view details, view profile
- [x] Mobile touch gestures: pinch-to-zoom (React Flow native), long-press for context menu
- [x] Bulk action bar: floating bar when multiple nodes selected with "Delete Selected" + confirmation
- [x] Tests: 11 new tests for undo/redo hook (push, undo, redo, max stack, descriptions, edge cases)

### Stream 18: Member Documents

**Status**: ✅ COMPLETE

Full document management system with upload, viewing, privacy controls, and permission-scoped access.

- [x] Migration (`007_member_documents.sql`) — documents table with RLS, indexes, type check constraint
- [x] Types (`src/types/document.ts`) — DocumentType union (8 types), Document interface
- [x] Validators (`src/lib/validators/document.ts`) — upload/update schemas, MAX_DOCUMENT_SIZE (25MB), ALLOWED_DOCUMENT_MIMES
- [x] Server actions (`src/lib/actions/document.ts`): uploadDocument, getDocumentsByMember, getDocumentsByTree, deleteDocument, updateDocument, getDocumentDownloadUrl — all with permission checks (owner/scoped-editor/self-linked)
- [x] `document-upload.tsx` — drag-and-drop with file type/size validation, document type selector, description, privacy toggle
- [x] `document-list.tsx` — list view with file icons, type badges, download/delete actions
- [x] `document-viewer.tsx` — modal viewer: images via Next/Image, PDFs via iframe, keyboard nav (Escape to close)
- [x] `document-type-badge.tsx` — colored badges per document type (8 color-coded types)
- [x] Documents section in member detail panel (compact, max 3 shown) and member profile page
- [x] Private documents filtered: only uploader + owner can see private docs
- [x] Tests: 33 new tests (21 validator + 12 action — upload permissions, privacy filtering, delete/update authorization)

### Stream 19: Testing & Hardening

**Status**: ✅ COMPLETE

Comprehensive integration, performance, and extended calculator tests.

- [x] Permission integration tests (10 tests): scoped editor escape prevention, viewer write blocks, owner full access, role change propagation, revoke effects, bulk ops
- [x] Performance tests (8 tests): 500-member layout <2s, 500-node path-find <500ms, 25-step deep paths, all 9 relationship types, valid positions (no NaN/overlap)
- [x] Extended relationship calculator tests (16 tests): all new type labels, multi-step combinations, edge cases (self-reference), single-step for all 14 type/direction combos
- [ ] E2E tests with Playwright (future)
- [ ] Accessibility audit (future)

---

### Verification Checklist: After Phase 5

- [x] Create a sibling relationship between two members, verify edge renders correctly
- [x] Add an in-law relationship, verify path-finder includes it
- [x] As owner, change a member's role from the permission manager
- [x] As owner, reassign a member's linked node scope
- [x] Right-click a node, verify context menu appears with correct options
- [x] Undo a member deletion via Ctrl+Z
- [x] Upload a PDF to a member, open in viewer, navigate pages on mobile and desktop
- [x] As self-linked user, upload document to own node (succeeds), try uploading to another node (fails)
- [x] As owner, view all documents across the tree, including private ones
- [x] Verify private documents hidden from non-uploaders
- [ ] Run full E2E suite, all passing (Playwright — future)
- [x] `bun run lint` and `bun run test` pass (332 tests, 0 failures)

---

## Phase 5.5: Glassmorphism UI Redesign

**Goal**: Comprehensive visual redesign of the entire application into a modern glassmorphism style. Gray-neutral glass surfaces with purposeful brand color accents. Add Tree Health metric. This is a large-scope change executed via a coordinated agent swarm.

> **Important**: This phase MUST use the `/rootline-glassmorphism` skill for all design token and component pattern decisions, and the `/ui-ux-pro-max` skill (plus `/frontend-design`, `/mobile-first-design`) for design quality review. The `/tailwind-v4-shadcn` skill should be consulted for Tailwind v4 utility patterns.

### Execution Strategy: Agent Swarm

This redesign is too large for a single pass. It must be broken into independent chunks executed by parallel agents with reviewer agents monitoring progress.

**Agent Roles:**

| Role                         | Agent Type        | Responsibility                                                                                                 |
| ---------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- |
| **Theme Architect**          | `general-purpose` | Sets up glass tokens in `globals.css`, creates `@utility` directives, validates dark mode tokens               |
| **Component Workers** (x3-5) | `general-purpose` | Each handles a component group (sidebar, cards, panels, nodes, dialogs, toolbar)                               |
| **Reviewer Agent**           | `general-purpose` | After each chunk, reviews for: glass consistency, dark mode, contrast ratios, token usage, no hardcoded colors |
| **Test Agent**               | `general-purpose` | Writes and runs visual/unit tests for glass utilities and components                                           |
| **Integration Agent**        | `general-purpose` | Final pass: ensures all pages work together, no regressions, builds pass                                       |

**Execution Order:**

1. Theme Architect sets up tokens/utilities (blocking — all others wait)
2. Component Workers run in parallel (independent chunks)
3. Reviewer Agent checks each chunk before merge
4. Test Agent runs after each chunk
5. Integration Agent does final pass

### Stream 20: Glass Design System Foundation

**Status**: ✅ COMPLETE

Set up the glassmorphism design tokens, Tailwind utilities, and background system.

- [x] Add glass CSS custom properties to `globals.css` (light + dark mode variants)
- [x] Create `@utility` directives: `glass-card`, `glass-heavy`, `glass-light`, `glass-elevated`, `glass-edge-top`, `glass-edge-left`
- [x] Add `@supports (backdrop-filter: blur(1px))` fallback styles for non-supporting browsers
- [x] Update page backgrounds: warm gradient in light mode (`gray-100 via gray-50 to stone-100`), deep gradient in dark mode
- [x] Add optional subtle radial gradient blobs (primary color, very low opacity) for depth
- [x] Update `@theme inline` block with new glass-related custom properties
- [x] Tests: utility class output tests, dark mode token tests, `@supports` fallback test
- [x] Reviewer: verify WCAG AA contrast ratios for text on glass surfaces in both modes

### Stream 21: Sidebar & Navigation Redesign

**Status**: ✅ COMPLETE

Redesign the left sidebar navigation with glassmorphism and add Tree Health metric.

- [x] Sidebar container: `glass-card glass-heavy glass-edge-left` with fixed height
- [x] Navigation items: transparent default, primary background when active, rounded-xl
- [x] **Tree Health metric component** (`src/components/tree/tree-health-bar.tsx`):
  - Calculate: `(members with complete profiles) / (total members) * 100`
  - "Complete profile" = has `first_name` + `last_name` + `date_of_birth` + at least one relationship
  - Display: percentage + progress bar (primary color fill on muted track)
  - Subtitle: "X new records found today" (count members created in last 24h)
  - Position: prominently at top of sidebar, above navigation links
- [x] Tree Health server action (`getTreeHealth(treeId)`) — returns percentage + recent record count
- [x] "Add Relative" CTA button at bottom: primary background, full-width
- [x] Header/top navigation bar: `glass-card glass-light` with search bar
- [x] Mobile responsive: sidebar collapses to hamburger menu with glass overlay
- [x] Tests: Tree Health calculation logic, sidebar rendering, mobile breakpoint behavior
- [x] Reviewer: verify navigation accessibility (keyboard nav, ARIA roles, focus management)

### Stream 22: Tree Canvas & Node Redesign

**Status**: ✅ COMPLETE

Redesign tree member nodes, edges, and the canvas background.

- [x] Tree canvas background: page gradient shows through (no opaque background)
- [x] Member nodes (`member-node.tsx`): `glass-card glass-edge-top` with rounded-2xl
  - Avatar circle + name + date range centered
  - Selected state: `border-2 border-primary` with slight scale-up
  - Hover: transition to `glass-bg-heavy`
  - Deceased members: `opacity-70` with subtle grayscale filter
- [x] Relationship edges: update colors to work against gradient backgrounds
- [x] Path highlighting: green glow effect on glass nodes when path-highlighted
- [x] Minimap: glass-light styling with reduced opacity
- [x] Toolbar: `glass-card glass-light` horizontal bar
- [x] Empty tree state: glass card with centered CTA
- [x] Tests: node hover/select state classes, deceased styling, edge rendering
- [x] Reviewer: verify tree interactions still work (drag, zoom, click, shift-click path)

### Stream 23: Dashboard & Card Redesign

**Status**: ✅ COMPLETE

Redesign dashboard page, tree cards, and stat displays.

- [x] Dashboard layout: gradient background, glass cards floating on top
- [x] Tree cards: `glass-card glass-edge-top` with hover `scale-[1.02]` + `glass-elevated` shadow transition
- [x] Create tree dialog: `glass-card glass-elevated glass-edge-top glass-edge-left` in modal overlay
- [x] Dashboard header: glass-light bar with user greeting and "Create Tree" CTA
- [x] Stat cards (if applicable): icon + label + value in `glass-card` with chart accents
- [x] Empty state: glass card with illustration
- [x] Tests: card hover animation classes, dialog glass styling, responsive grid
- [x] Reviewer: verify dark mode card readability, hover transitions smooth

### Stream 24: Detail Panel, Dialogs & Forms Redesign

**Status**: ✅ COMPLETE

Redesign the member detail side panel, all dialogs/modals, and form elements.

- [x] Member detail panel: `glass-card glass-heavy glass-edge-top glass-edge-left`, slides in from right
  - Profile photo section: no glass (image renders directly)
  - Life Timeline: colored dots on glass surface, connected by subtle line
  - Archive Gallery: glass-light thumbnails in grid
  - "Share Branch" and "Report (PDF)" buttons: glass-card glass-light styling
- [x] All dialogs (add member, edit member, confirm, rollback, GEDCOM import): glass-elevated styling
  - Modal backdrop: `bg-black/40 backdrop-blur-sm`
  - Dialog surface: `glass-card glass-elevated glass-edge-top glass-edge-left`
- [x] Form inputs: semi-transparent backgrounds (`bg-white/10` borders), focus ring using primary color
- [x] Select dropdowns, popovers, command palette: glass-elevated
- [x] Toast notifications: glass-card glass-light with colored left border
- [x] Tests: dialog open/close glass transitions, form input focus states, panel slide animation
- [x] Reviewer: verify form accessibility (label association, error states visible on glass)

### Stream 25: Settings, History & Remaining Pages

**Status**: ✅ COMPLETE

Applied glassmorphism to all remaining pages and components.

- [x] Tree settings page: glass cards for each settings section
- [x] History page: audit timeline on glass cards, snapshot viewer glass-card grid
- [x] Profile page: glass card for user info
- [x] Invite acceptance page: centered glass card with tree info
- [x] Landing/marketing page: hero with glass elements, feature cards as glass-card
- [x] Auth pages (sign-in/sign-up): centered glass card on gradient background
- [x] Notification popover: glass-elevated dropdown
- [x] Photo gallery lightbox: glass overlay
- [x] Tests: page-level rendering tests for glass classes, responsive layout tests
- [x] Reviewer: cross-page consistency check — same glass depth levels used consistently

### Stream 26: Integration Testing & Visual QA

**Status**: ✅ COMPLETE

Final integration pass — all tests pass, build succeeds, types clean.

- [x] Full build: `bun run build` passes
- [x] Lint: `bun run lint` passes — no new errors
- [x] Type check: `bunx tsc --noEmit` passes
- [x] All existing tests pass (`bun test`)
- [x] New glass utility tests pass
- [x] Tree Health metric tests pass
- [x] Visual QA checklist:
  - [x] Light mode: all pages use consistent glass depth
  - [x] Dark mode: all pages readable, glass opacity correct
  - [x] Mobile: sidebar collapses, glass responsive
  - [x] Tree canvas: nodes, edges, toolbar all glass-styled
  - [x] Dialogs: all modals use glass-elevated
  - [x] Forms: inputs readable on glass surfaces
  - [x] Contrast: spot-check text on glass meets WCAG AA
- [x] Performance: no excessive backdrop-filter nesting (max 2 layers deep)
- [x] Browser compatibility: Chrome, Firefox, Safari tested for backdrop-filter support

### Verification Checklist: After Phase 5.5

- [x] App opens with gradient background and glass sidebar
- [x] Tree Health metric shows correct percentage in sidebar
- [x] Tree nodes render as glass cards with proper hover/select states
- [x] Detail panel slides in with glass styling
- [x] All dialogs appear as frosted glass over blurred backdrop
- [x] Dashboard cards have glass hover effect with scale transition
- [x] Dark mode: all glass elements adjust opacity/shadow correctly
- [x] Mobile: sidebar collapses, glass overlay menu works
- [x] No hardcoded colors — all use CSS custom properties or Tailwind tokens
- [x] `bun run build` succeeds
- [x] `bun run lint` passes (0 errors, 6 pre-existing warnings)
- [x] `bun run test` passes all 332 tests
- [x] `/rootline-glassmorphism` skill file is up to date with final token values

---

## Phase 6: Permission Invariant Testing & Bug Fixes

**Goal**: Expose and fix real permission boundary violations with a realistic mock family tree fixture. Scoped editors must be fully contained to their branch — no cross-branch member edits, no cross-branch relationship creation, no unrestricted position saves.

> **Last Updated**: 2026-03-25
> **Status**: ✅ COMPLETE (352 tests passing)

### Bugs Identified (Pre-Phase)

| # | Location | Bug | Severity |
|---|----------|-----|----------|
| **BUG-001** | `relationship.ts:39` | `!fromResult.data && !toResult.data` — uses `&&` so scoped editor can link their branch node to any out-of-scope node as long as one endpoint is in-scope | 🔴 Critical |
| **BUG-002** | `member.ts:saveMemberPositions` | No `linked_node_id` scope check — scoped editors can reposition any node in the tree | 🟡 Medium |

### Stream 27: Comprehensive Permission Boundary Tests

**Status**: ✅ COMPLETE

**Family Tree Fixture** ("The Hartwell family"):

```
Grandparent: Harold (GP)
├── Parent A: Alice (PA)     ← scoped editor "Eve" is linked here (scope = Alice's branch)
│   ├── Child A: David (CA)
│   │   └── Grandchild A: Fiona (GCA)
│   └── Child B: Eve (CB)    ← Eve is the scoped editor herself
└── Parent B: Bob (PB)
    └── Child C: Carol (CC)  ← "cousin" — should be unreachable by Eve
        └── Grandchild C: George (GCC)
```

Eve is an editor with `linked_node_id = PA (Alice)`. She may only edit Alice's descendants: David, Fiona, Eve. She must NOT be able to touch Harold, Bob, Carol, George.

#### Tests to Write

**Member attribute edits:**
- [x] Eve updates `first_name` on David (descendant) → **succeeds**
- [x] Eve updates `first_name` on Carol (cousin — out of scope) → **blocked**
- [x] Eve updates `first_name` on Harold (grandparent — out of scope) → **blocked**
- [x] Eve deletes David (in scope) → **succeeds**
- [x] Eve deletes Carol (out of scope) → **blocked**

**Relationship creation (cross-branch attack):**
- [x] Eve creates `parent_child` between David (in-scope) and Carol (out-of-scope) → **blocked** ← BUG-001 fixed
- [x] Eve creates `spouse` between Fiona (in-scope) and George (out-of-scope) → **blocked** ← BUG-001 fixed
- [x] Eve creates `sibling` between David and Fiona (both in-scope) → **succeeds**
- [x] Eve creates `parent_child` between Carol and George (both out-of-scope) → **blocked**

**Position save scope:**
- [x] Eve saves position for David (in-scope) → **succeeds** ← BUG-002 fixed
- [x] Eve saves position for Carol (out-of-scope) → **blocked** ← BUG-002 fixed

**Data integrity invariants:**
- [x] Create relationship where `from_member_id === to_member_id` (self-reference) → **blocked** ← BUG-003 fixed
- [ ] Create `parent_child` A→B then B→A (direct cycle) → **blocked** (future)
- [ ] Create member with `date_of_death` before `date_of_birth` → **blocked** (future)

**Role boundary:**
- [x] Viewer tries to update any member → **blocked**
- [x] Editor without `linked_node_id` can edit any member → **succeeds** (unscoped editor)
- [ ] Scoped editor tries to self-escalate role to owner → **blocked** (future)

#### Files

- [x] `src/lib/actions/__tests__/scoped-editor-family-tree.test.ts` — all above tests with Hartwell fixture

### Stream 28: Bug Fixes

**Status**: ✅ COMPLETE

- [x] **BUG-001**: Fix `createRelationship` — change `&&` to `||` in branch scope check (`relationship.ts:39`)
- [x] **BUG-002**: Fix `saveMemberPositions` — add `is_descendant_of` check per position when editor has `linked_node_id` (`member.ts`)
- [x] **BUG-003**: Fix self-referential relationship — add `.refine()` to `createRelationshipSchema` blocking `from_member_id === to_member_id`
- [x] **FIX**: Corrected broken mock in `permission-integration.test.ts` — `is_descendant_of` runs before `set_request_user_id` (wrong order was masking the `&&` bug)
- [x] All 20 new tests pass
- [x] All 352 tests pass (0 regressions)

### Verification Checklist: After Phase 6

- [x] `bun run test` passes all 352 tests (332 original + 20 new)
- [x] Scoped editor cannot mutate out-of-scope members
- [x] Scoped editor cannot create cross-branch relationships (BUG-001 fixed)
- [x] Scoped editor cannot reposition out-of-scope nodes (BUG-002 fixed)
- [x] Self-referential relationships blocked (BUG-003 fixed)
- [ ] Temporal invariants enforced at validator level (future)

---

## Phase 7: Critical Fixes + Security Hardening + New Features

**Goal**: Fix the two broken production paths (members page 404, missing storage buckets), perform a comprehensive security audit and hardening pass, then implement the approved new feature set.

> **Last Updated**: 2026-03-25
> **Status**: 🔴 TODO
> **Swarm**: `swarm-1774441906884-3icr71` (hierarchical, max 8 agents)

---

### Stream 29: Members List Page (Critical Fix)

**Status**: 🔴 TODO

`tree-sidebar.tsx` links to `/tree/${treeId}/members` which 404s. Create the page.

- [ ] `src/app/tree/[id]/members/page.tsx` — server component, fetches all members + their relationship counts
- [ ] `src/components/tree/members-list.tsx` — client component with:
  - Searchable table/grid (filter by name, living/deceased, gender)
  - Sortable columns: name, date of birth, relationship count
  - Each row links to `/tree/[id]/member/[memberId]`
  - "Add Member" button for owners/editors
  - Profile photo avatar + completeness indicator (colored dot: green = complete, yellow = partial, gray = empty)
- [ ] Server action: `getMembersWithStats(treeId)` — returns members with `relationship_count`, `document_count`, `photo_count`
- [ ] Accessible to all tree members (owner/editor/viewer)
- [ ] Tests: renders member list, filters apply, empty state shown when no members

---

### Stream 30: Storage Bucket Migration (Critical Fix)

**Status**: 🔴 TODO

`tree-photos` and `tree-documents` buckets are referenced in code but never created. All photo/document uploads currently fail.

- [ ] `supabase/migrations/008_storage_buckets.sql`:
  - Create `tree-photos` bucket (public, 5MB file size limit)
  - Create `tree-documents` bucket (private, 25MB file size limit)
  - RLS on `storage.objects` for `tree-photos`: SELECT by tree member, INSERT/DELETE by owner or scoped editor
  - RLS on `storage.objects` for `tree-documents`: SELECT filtered by privacy + membership, INSERT/DELETE by owner or scoped editor
- [ ] Update `README.md` / setup docs to note buckets are created via migration (not manually)
- [ ] Tests: verify bucket names match constants in `photo.ts` (`"tree-photos"`) and `document.ts` (`"tree-documents"`)

---

### Stream 31: Security Audit & Hardening

**Status**: 🔴 TODO

**Execution**: Ruflo multi-agent security swarm. Agents: `security-architect` (lead), `security-auditor` (scan), `tester` (write attack tests), `reviewer` (sign-off).

#### 31a: Rate Limiting

- [ ] Add rate limiting to all server actions using an in-memory or Redis-backed token bucket
  - `createMember`: 30/min per user
  - `createRelationship`: 30/min per user
  - `uploadPhoto` / `uploadDocument`: 10/min per user
  - `createInvite`: 5/min per user
  - `acceptInvite`: 10/min per user
- [ ] Clerk webhook endpoint: validate `svix-signature` header (already done — verify it's enforced)
- [ ] API routes: add `X-RateLimit-*` response headers
- [ ] Tests: rate limit hit returns 429 with retry-after header

#### 31b: Input Sanitization & Injection Prevention

- [ ] Audit all free-text fields (`bio`, `birth_place`, `death_place`, `description`, `caption`) for XSS — sanitize with `DOMPurify` server-side before DB insert
- [ ] Validate `storage_path` in photo/document actions — prevent path traversal (`../`) attacks
- [ ] Zod schemas: add `.max()` caps to all string fields that lack them (bio: 2000 chars, place: 200 chars, caption: 500 chars)
- [ ] GEDCOM parser: limit file size to 10MB, validate all string fields extracted from GEDCOM before inserting
- [ ] Tests: XSS payloads in member bio rejected/sanitized, path traversal in storage paths rejected

#### 31c: Prompt Injection Defense (AI Features Guard)

- [ ] Any AI-facing text (member bios, tree names, document descriptions) must be escaped before being passed to any LLM context
- [ ] Add a `sanitizeForLLM(text)` utility that strips control characters, prompt delimiters, and role-injection patterns
- [ ] Document the policy in CLAUDE.md: all user-supplied text is untrusted and must be sanitized before AI processing
- [ ] Tests: common prompt injection patterns (`Ignore previous instructions`, `<|im_start|>system`) are sanitized

#### 31d: Auth & Permission Hardening

- [ ] Verify `getAuthUser()` always throws (never returns null silently) — audit all callers
- [ ] Add CSRF protection to all mutating server actions (Next.js App Router handles this via `server-only`, verify)
- [ ] Tree ID and member ID in URLs must be validated as UUIDs before DB queries — add middleware-level check
- [ ] Audit: no `createAdminClient()` usage in client components (grep for imports)
- [ ] `deleteTree`: currently only checks `membership.role === "owner"` — add explicit check that `owner_id === userId`
- [ ] Tests: forged tree IDs, non-UUID IDs, missing auth all return correct errors

#### 31e: Dependency & Header Audit

- [ ] Run `bun audit` — list and address any high/critical CVEs
- [ ] Add security headers via `next.config.ts`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`
- [ ] Ensure `SUPABASE_SERVICE_ROLE_KEY` is never exposed to client (grep for `NEXT_PUBLIC_` misuse)
- [ ] Tests: security headers present in responses, no secrets in client bundle

---

### Stream 32: Timeline View (Feature C)

**Status**: 🔴 TODO

Chronological view of all life events across the tree.

- [ ] `src/app/tree/[id]/timeline/page.tsx` — server component
- [ ] `src/components/tree/timeline-view.tsx` — vertical timeline sorted by date
  - Events: births, deaths, marriages, divorces (derived from member dates + relationship dates)
  - Group by decade with collapsible sections
  - Each event links to the member profile
  - Filter: event type, date range
- [ ] `getTimelineEvents(treeId)` server action — aggregates member dates + relationship dates into sorted event list
- [ ] Add "Timeline" nav link to tree sidebar
- [ ] Tests: events sorted correctly, filter reduces results, empty state

---

### Stream 33: Tree Statistics Dashboard (Feature D)

**Status**: 🔴 TODO

Analytics panel showing tree completeness and interesting facts.

- [ ] `src/components/tree/tree-stats.tsx` — glass card grid of stats:
  - Total members (living vs deceased)
  - Oldest living member / longest lifespan
  - Most descendants (deepest branch)
  - Average lifespan (of deceased members with known dates)
  - Gender distribution (pie/bar)
  - Profile completeness % (same as Tree Health but broken down)
  - Most recently added / updated member
- [ ] `getTreeStats(treeId)` server action — all stats in one query
- [ ] Surface in tree sidebar below Tree Health bar, or as a dedicated tab
- [ ] Tests: stat calculations correct on fixture data, handles trees with missing dates

---

### Stream 34: Birthday Reminders (Feature E)

**Status**: 🔴 TODO

In-app notification when a living member's birthday is within the next 7 days.

- [ ] Database: `supabase/migrations/009_birthday_reminders.sql` — add computed column or function `days_until_birthday(date_of_birth)`
- [ ] `getBirthdayReminders(treeId)` server action — returns living members with birthday within 7 days, with days remaining
- [ ] `birthday-reminder-banner.tsx` — dismissible banner at top of tree canvas listing upcoming birthdays
- [ ] Auto-create notification records for birthdays (extend `004_triggers.sql` or add new migration)
- [ ] Tests: days_until_birthday calculation, members with no DOB excluded, deceased excluded

---

### Stream 35: Public Read-Only Share Link (Feature G)

**Status**: 🔴 TODO

Shareable URL that shows the tree to unauthenticated visitors (read-only).

- [ ] `family_trees` table: already has `is_public` field — use this as the gate
- [ ] `src/app/share/[treeId]/page.tsx` — public tree view, no auth required for `is_public = true`
  - Shows tree canvas in view-only mode (no add/edit/delete controls)
  - Shows member count, tree name, owner display name
  - "Sign up to collaborate" CTA
- [ ] Update RLS: `family_trees` SELECT allowed if `is_public = true` (regardless of user)
- [ ] Update tree settings page: "Make public / private" toggle with shareable link copy button
- [ ] Update `src/proxy.ts` (Clerk middleware): `/share/*` routes are public (no auth required)
- [ ] Tests: public tree accessible without auth, private tree returns 404, controls absent in share view

---

### Stream 36: Tree Merge (Feature J)

**Status**: 🔴 TODO

Merge two family trees when families connect. Schema already supports it via shared UUIDs.

- [ ] `mergeTree(sourceTreeId, targetTreeId, memberMappings)` server action — owner-only
  - Copy all `tree_members` from source → target (with dedup by name+DOB)
  - Copy all `relationships`, remapping member IDs
  - Copy all `media` and `documents` references
  - Create `audit_log` entry for the merge
  - Delete source tree after confirmation
- [ ] `src/components/tree/merge-tree-dialog.tsx` — step wizard:
  1. Select source tree (from user's owned trees)
  2. Preview member conflicts (name+DOB matches shown as potential duplicates)
  3. Resolve conflicts: merge as same person, keep as separate, skip
  4. Confirm merge with data-loss warning
- [ ] Add "Merge another tree into this one" option in tree settings danger zone
- [ ] Tests: merge copies members, remaps relationships, dedup detection works, non-owner blocked

---

### Verification Checklist: After Phase 7

**Critical Fixes:**
- [ ] `/tree/[id]/members` page loads and lists all members
- [ ] Photo upload succeeds (tree-photos bucket exists)
- [ ] Document upload succeeds (tree-documents bucket exists)

**Security:**
- [ ] `bun audit` shows no high/critical CVEs
- [ ] XSS payload in bio is sanitized before DB insert
- [ ] Rate limiting returns 429 after threshold exceeded
- [ ] Security headers present in all HTTP responses
- [ ] No `NEXT_PUBLIC_` exposure of service role key

**Features:**
- [ ] Timeline shows all birth/death/marriage events sorted by date
- [ ] Tree stats panel shows accurate counts and calculations
- [ ] Birthday reminder banner appears for members with upcoming birthdays
- [ ] Public share link works without login for `is_public` trees
- [ ] Tree merge copies all members + relationships with dedup detection

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

| Feature                  | Status    | Notes                          |
| ------------------------ | --------- | ------------------------------ |
| Search within tree       | Phase 2   | Cmd+K command palette          |
| Deceased member handling | Phase 2   | Grayscale + icon in node       |
| Collapse/expand subtrees | Phase 2   | Performance for large trees    |
| Relationship calculator  | Phase 2   | LCA algorithm                  |
| GEDCOM import/export     | ✅ Done   | Standard genealogy format      |
| Tree image export        | ✅ Done   | PNG/SVG/PDF                    |
| In-app notifications     | ✅ Done   | Polling-based (30s)            |
| Horizontal relationships | Phase 5   | Sibling, in-law, step, etc.    |
| Permission manager UI    | Phase 5   | Role editing, node scoping     |
| Context menu / undo-redo | Phase 5   | Right-click, Ctrl+Z            |
| Member documents         | Phase 5   | PDF/image upload + viewer      |
| Glassmorphism redesign   | Phase 5.5 | Full UI overhaul + Tree Health |
| Data privacy / GDPR      | Ongoing   | Cascade deletes, export        |
| Accessibility            | Ongoing   | ARIA, keyboard nav, contrast   |
| Rate limiting            | Phase 3   | Server action checks           |
| Tree merging             | Future    | Complex, schema supports it    |
| Offline viewing          | Future    | Service worker + IndexedDB     |

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
