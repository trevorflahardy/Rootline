# Rootline

**Map Your Family Story** — A modern, collaborative family lineage tracking application.

Rootline helps families come together to build, explore, and preserve their family trees. Create a tree, invite relatives, and watch your lineage grow as everyone contributes their branch of the family.

---

## Features

### Interactive Family Tree Visualization
- Pan, zoom, and explore your family tree with an interactive canvas
- Custom node rendering with avatars, names, birth/death dates, and relationship indicators
- Click any member to view their full profile, photos, and connections
- Mobile-friendly with touch gestures (pinch to zoom, pan)

### Relationship Path Highlighting
- Select any two members to see how they're connected
- A highlighted green path traces the relationship through the tree
- Automatically calculates and displays the relationship (e.g., "2nd cousin once removed", "great uncle")

### Collaborative Tree Building
- Create a family tree and invite relatives via shareable links or invite codes
- Permission-scoped editing: invited members can add their descendants but can't modify others' branches
- Role-based access: **Owner** (full control), **Editor** (scoped editing), **Viewer** (read-only)
- Self-assignment: members can link their account to their node in the tree

### Version History & Audit Log
- Every change is tracked with a full audit trail (who changed what, when)
- Tree owners can view the complete history timeline
- Create snapshots and roll back to any previous state

### Photo Management
- Upload profile photos for each family member
- Create photo galleries for members and the tree as a whole
- Drag-and-drop uploads with automatic compression

### GEDCOM Import/Export
- Import existing family trees from standard GEDCOM 5.5.1 files (compatible with Ancestry.com, MyHeritage, etc.)
- Export your tree as a GEDCOM file for use in other genealogy software

### Tree Export
- Download your family tree visualization as a PNG image or PDF for printing and sharing

### Real-time Notifications
- Get notified when family members update the tree
- In-app notification bell with unread count
- Live tree updates — see changes as they happen

### Modern UI/UX
- Clean, modern interface built with shadcn/ui
- Light and dark mode with system preference detection
- Fully responsive — works beautifully on desktop, tablet, and mobile
- SEO-optimized landing page

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, React 19, TypeScript) |
| Runtime | [Bun](https://bun.sh/) |
| Authentication | [Clerk](https://clerk.com/) |
| Database | [Supabase](https://supabase.com/) (PostgreSQL) |
| File Storage | [Supabase Storage](https://supabase.com/storage) |
| Real-time | [Supabase Realtime](https://supabase.com/realtime) |
| Tree Visualization | [React Flow](https://reactflow.dev/) + [Dagre](https://github.com/dagrejs/dagre) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS v4](https://tailwindcss.com/) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Deployment | [Vercel](https://vercel.com/) |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- A [Clerk](https://clerk.com/) account (free tier available)
- A [Supabase](https://supabase.com/) project (free tier available)

### 1. Clone the repository

```bash
git clone https://github.com/your-username/rootline.git
cd rootline
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up environment variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 4. Set up the database

Run the SQL migrations in your Supabase project's SQL Editor, in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_functions.sql`
3. `supabase/migrations/003_rls_policies.sql`
4. `supabase/migrations/004_triggers.sql`

### 5. Configure Clerk Webhook

In your Clerk Dashboard:
1. Go to **Webhooks**
2. Add endpoint: `https://your-domain.com/api/webhooks/clerk`
3. Subscribe to events: `user.created`, `user.updated`
4. Copy the signing secret to `CLERK_WEBHOOK_SECRET`

### 6. Run the development server

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
src/
├── app/                    # Next.js App Router pages and layouts
│   ├── (marketing)/        # Landing page (public)
│   ├── (auth)/             # Sign-in/sign-up (Clerk)
│   ├── (dashboard)/        # User dashboard (protected)
│   ├── tree/[id]/          # Tree view, settings, history, members
│   ├── invite/[code]/      # Invite acceptance
│   └── api/                # API routes (webhooks)
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── tree/               # Tree visualization components
│   ├── dashboard/          # Dashboard components
│   ├── layout/             # Header, footer, nav, theme toggle
│   └── shared/             # Loading, error, empty states
├── lib/
│   ├── supabase/           # Database client setup
│   ├── actions/            # Server actions (CRUD)
│   ├── utils/              # Tree layout, path finder, GEDCOM, etc.
│   ├── hooks/              # React hooks (permissions, realtime)
│   └── validators/         # Zod validation schemas
└── types/                  # TypeScript type definitions
```

---

## Scripts

| Command | Description |
|---------|------------|
| `bun dev` | Start development server (Turbopack) |
| `bun run build` | Production build |
| `bun run start` | Start production server |
| `bun run lint` | Run ESLint |
| `bun test` | Run tests (Vitest) |

---

## Architecture

### Authentication Flow
1. User signs up/in via Clerk's UI components
2. Clerk middleware protects routes and manages sessions
3. On user creation, a webhook syncs the profile to Supabase
4. Server actions use Clerk's `auth()` to identify the user, then query Supabase

### Permission Model
- **Owner**: Full control over tree, members, invites, settings, history
- **Editor**: Can add/edit members and relationships *below* their linked node in the tree
- **Viewer**: Read-only access to the tree

Permissions are enforced at three levels:
1. **UI**: Hide/disable actions based on role
2. **Server Actions**: Check permissions before mutations
3. **Database (RLS)**: Row-Level Security policies prevent unauthorized access

### Tree Visualization
- React Flow provides the interactive canvas with pan/zoom/minimap
- Dagre computes hierarchical node positions automatically
- Custom nodes show member info with avatars and visual indicators
- Custom edges differentiate relationship types (parent-child, spouse, adopted)
- BFS pathfinding highlights connections between selected members

---

## License

[Business Source License 1.1](LICENSE) — Source code is publicly visible for reference and learning. Commercial use requires a separate license. See the LICENSE file for full terms.

Copyright (c) 2026 Rootline. All rights reserved.
