# Rootline - Implementation Plan & Progress Tracker

> **Last Updated**: 2026-03-23
> **Status**: Phase 5 - Not Started (Phases 1–4 Complete)

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

**Status**: ⏳ NOT STARTED

Currently, the tree only supports direct vertical relationships (parent→child) and spouse connections. This stream adds the ability to link family members who aren't directly related but connected horizontally — e.g., siblings-in-law, step-parents, co-parents.

- [ ] Extend `relationship_type` enum: add `sibling`, `step_parent`, `step_child`, `in_law`, `guardian` types
- [ ] Database migration (`006_extended_relationships.sql`) — ALTER CHECK constraint on `relationships.relationship_type`
- [ ] Update `relationship-calculator.ts` — handle new relationship types in path traversal and label generation
- [ ] Update `createRelationshipSchema` validator — accept new relationship types
- [ ] `add-relationship-dialog.tsx` — new dialog for linking two existing members with any relationship type (not just via add-member flow)
- [ ] Update `relationship-edge.tsx` — distinct visual styles for new edge types (dotted for in-law, dashed for step, etc.)
- [ ] Update `tree-layout.ts` — layout algorithm adjustments for horizontal relationships (siblings placed side-by-side, in-laws grouped near spouse)
- [ ] Update `path-finder.ts` — BFS traversal includes new relationship types
- [ ] Update GEDCOM parser/exporter to handle extended relationship types
- [ ] Tests: relationship calculator with new types, layout with horizontal edges

### Stream 16: Permission Management Dashboard

**Status**: ⏳ NOT STARTED

Improve the tree settings page with a dedicated permission management view.

- [ ] `permission-manager.tsx` — table/list of all tree members with role, linked node, last active
- [ ] Inline role editing (owner can change editor↔viewer)
- [ ] Inline linked node reassignment (owner can change which node a member is scoped to)
- [ ] Bulk operations: revoke access, change roles for multiple members
- [ ] Activity indicators: show when each member last edited the tree
- [ ] Integrate into tree settings page (`/tree/[id]/settings`)

### Stream 17: Tree UX Improvements

**Status**: ⏳ NOT STARTED

- [ ] Drag-and-drop member reordering within the tree canvas
- [ ] Multi-select nodes (shift+click) for bulk operations (delete, move branch)
- [ ] Undo/redo for tree edits (client-side action stack)
- [ ] Keyboard shortcuts: Delete to remove selected node, Ctrl+Z to undo
- [ ] Context menu (right-click) on nodes: edit, delete, add child, add spouse, view details
- [ ] Mobile touch gestures: pinch-to-zoom, long-press for context menu

### Stream 18: Member Documents

**Status**: ⏳ NOT STARTED

Allow users to attach documents (birth certificates, marriage licenses, immigration papers, etc.) to tree members. Self-linked users can upload to their own node; owners/editors can upload to anyone in their scope.

**Database:**
- [ ] Migration (`006_member_documents.sql`) — new `documents` table: id UUID, tree_id, member_id (refs tree_members), uploaded_by, storage_path, file_name, file_size, mime_type, document_type (enum: birth_certificate, marriage_license, death_certificate, immigration, legal, medical, photo_album, other), description, is_private (boolean, default false), created_at
- [ ] Supabase Storage bucket: `tree-documents` with RLS policies
- [ ] RLS: read if tree member (respect `is_private` — only uploader + owner can see private docs), write if owner/editor within scope OR self-linked user uploading to own node

**Server Actions (`src/lib/actions/document.ts`):**
- [ ] `uploadDocument(treeId, memberId, file, metadata)` — upload to Supabase Storage, create DB record
- [ ] `getDocumentsByMember(treeId, memberId)` — list documents for a member (filtered by privacy)
- [ ] `getDocumentsByTree(treeId)` — list all documents in a tree (owner only)
- [ ] `deleteDocument(documentId, treeId)` — delete from storage + DB (uploader or owner)
- [ ] `updateDocument(documentId, treeId, metadata)` — update description, type, privacy
- [ ] Permission checks: self-linked users can upload to their own node only; editors scoped to their branch; owners can upload anywhere

**Components:**
- [ ] `src/components/documents/document-upload.tsx` — drag-and-drop upload with file type validation (PDF, images, .doc/.docx), max 25MB, document type selector, optional description, privacy toggle
- [ ] `src/components/documents/document-list.tsx` — grid/list view of attached documents with thumbnails (PDF first page preview, image thumbnails), download button, delete (if permitted)
- [ ] `src/components/documents/document-viewer.tsx` — full-screen modal PDF/image viewer optimized for mobile and web:
  - PDF rendering via `react-pdf` (pdf.js wrapper) with page navigation, zoom, pinch-to-zoom on mobile
  - Image viewer with zoom/pan
  - Responsive: full-screen on mobile, modal on desktop
  - Download button, share button
  - Keyboard navigation: arrow keys for pages, Escape to close
- [ ] `src/components/documents/document-type-badge.tsx` — colored badge per document type

**Integration:**
- [ ] Add "Documents" tab/section to member detail panel (`member-detail-panel.tsx`)
- [ ] Add document count badge on member nodes in the tree canvas
- [ ] Add "Documents" section to member detail page (`/tree/[id]/member/[memberId]`)
- [ ] Validators: `src/lib/validators/document.ts` — file size, mime type, document type enum

**Tests:**
- [ ] Unit tests: document validators, permission logic
- [ ] Integration tests: upload flow, privacy filtering, scope enforcement

### Stream 19: Testing & Hardening

**Status**: ⏳ NOT STARTED

- [ ] E2E tests with Playwright: tree CRUD, invite flow, permission scoping, GEDCOM import, document upload
- [ ] Permission integration tests: verify scoped editors cannot escape their branch
- [ ] Performance tests: trees with 500+ members
- [ ] Accessibility audit: screen reader, keyboard-only navigation, WCAG 2.1 AA

---

### Verification Checklist: After Phase 5

- [ ] Create a sibling relationship between two members, verify edge renders correctly
- [ ] Add an in-law relationship, verify path-finder includes it
- [ ] As owner, change a member's role from the permission manager
- [ ] As owner, reassign a member's linked node scope
- [ ] Right-click a node, verify context menu appears with correct options
- [ ] Undo a member deletion via Ctrl+Z
- [ ] Upload a PDF to a member, open in viewer, navigate pages on mobile and desktop
- [ ] As self-linked user, upload document to own node (succeeds), try uploading to another node (fails)
- [ ] As owner, view all documents across the tree, including private ones
- [ ] Verify private documents hidden from non-uploaders
- [ ] Run full E2E suite, all passing
- [ ] `bun run lint` and `bun test` pass

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

| Feature                  | Status  | Notes                        |
| ------------------------ | ------- | ---------------------------- |
| Search within tree       | Phase 2 | Cmd+K command palette        |
| Deceased member handling | Phase 2 | Grayscale + icon in node     |
| Collapse/expand subtrees | Phase 2 | Performance for large trees  |
| Relationship calculator  | Phase 2 | LCA algorithm                |
| GEDCOM import/export     | ✅ Done | Standard genealogy format    |
| Tree image export        | ✅ Done | PNG/SVG/PDF                  |
| In-app notifications     | ✅ Done | Polling-based (30s)          |
| Horizontal relationships | Phase 5 | Sibling, in-law, step, etc.  |
| Permission manager UI    | Phase 5 | Role editing, node scoping   |
| Context menu / undo-redo | Phase 5 | Right-click, Ctrl+Z          |
| Member documents         | Phase 5 | PDF/image upload + viewer    |
| Data privacy / GDPR      | Ongoing | Cascade deletes, export      |
| Accessibility            | Ongoing | ARIA, keyboard nav, contrast |
| Rate limiting            | Phase 3 | Server action checks         |
| Tree merging             | Future  | Complex, schema supports it  |
| Offline viewing          | Future  | Service worker + IndexedDB   |

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
