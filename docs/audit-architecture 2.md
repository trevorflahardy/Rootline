## Architecture & Consistency Audit

**Date:** 2026-03-28
**Scope:** Full source tree of the RootLine family tree app (`lineage_tracker`)
**Status:** Research-only -- no files were modified

---

### File Organization Issues

#### 1. Root directory clutter

The following files in the project root violate the CLAUDE.md rule "NEVER save to root folder":

| File               | Should be in            | Severity |
| ------------------ | ----------------------- | -------- |
| `security_scan.sh` | `scripts/`              | Medium   |
| `skills-lock.json` | `config/` or `.agents/` | Low      |
| `PLAN.md`          | `docs/`                 | Low      |

Standard config files that are acceptable at root: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `postcss.config.mjs`, `next.config.ts`, `components.json`, `.gitignore`, `.env*`, `.mcp.json`, `CLAUDE.md`, `README.md`, lock files, `next-env.d.ts`.

#### 2. Files exceeding the 500-line limit

CLAUDE.md mandates "Keep files under 500 lines." The following source files violate this:

| File                                          | Lines | Over by |
| --------------------------------------------- | ----- | ------- |
| `src/components/tree/tree-canvas.tsx`         | 1,537 | 1,037   |
| `src/components/tree/member-detail-panel.tsx` | 1,432 | 932     |
| `src/lib/actions/permissions.ts`              | 526   | 26      |

`tree-canvas.tsx` is **3x the limit** and is the single largest risk for maintainability. It should be decomposed into at minimum: canvas setup/config, node management logic, realtime/collaboration logic, layout computation, and event handlers.

`member-detail-panel.tsx` similarly needs decomposition -- the relationship list builders (lines ~650-810) are highly repetitive and should be extracted into a shared helper.

#### 3. Test file location inconsistency

Tests are split across two patterns with no clear rule for which goes where:

- **`src/` colocated tests (32 files):** Use `__tests__/` subdirectories (e.g., `src/lib/actions/__tests__/tree.test.ts`) OR sit alongside source (e.g., `src/lib/utils/date.test.ts`, `src/lib/validators/member.test.ts`).
- **`tests/` directory (21 files):** Contains `tests/security/`, `tests/tree/`, `tests/validation/`, `tests/a11y/`, `tests/actions/`, `tests/e2e/`.

Within `src/` itself, two conventions coexist:

- `__tests__/` subdirectory pattern: 19 files across `src/lib/actions/__tests__/`, `src/lib/utils/__tests__/`, `src/lib/hooks/__tests__/`, `src/components/permissions/__tests__/`
- Adjacent file pattern: 7 files like `src/lib/utils/date.test.ts`, `src/lib/validators/tree.test.ts`

**Recommendation:** Standardize on one pattern. The `__tests__/` subdirectory approach is used more frequently and keeps directories cleaner.

#### 4. No `docs/` directory existed

The `docs/` directory did not exist prior to this audit, despite CLAUDE.md specifying it as the home for documentation and markdown files. `PLAN.md` (1,419 lines) sits in the root.

#### 5. Component test coverage is extremely sparse

Only 1 component has a test file (`src/components/permissions/__tests__/permission-manager.test.tsx`). The remaining ~48 exported components in `src/components/` have zero unit/integration tests. The `tests/a11y/components.test.tsx` file exists but is a single accessibility test, not component behavior tests.

---

### Naming Inconsistencies

#### 1. Component file naming: consistent kebab-case -- PASS

All component files use kebab-case (e.g., `tree-canvas.tsx`, `add-member-dialog.tsx`, `notification-bell.tsx`). This is consistent throughout.

#### 2. Component export naming: consistent PascalCase -- PASS

All 48 exported components use PascalCase function names (e.g., `export function TreeCanvas`, `export function MemberDetailPanel`). All use named `function` declarations, not arrow functions. This is consistent.

#### 3. Action file naming: consistent kebab-case -- PASS

All action files use kebab-case: `tree.ts`, `member.ts`, `relationship.ts`, `tree-stats.ts`, `tree-health.ts`, etc.

#### 4. Test file naming: `.test.ts` only -- PASS for unit tests

All unit/integration tests use `.test.ts` or `.test.tsx`. E2E tests in `tests/e2e/` use `.spec.ts` (Playwright convention). This split is appropriate.

#### 5. Variable/function naming: mostly camelCase -- PASS with exceptions

Exported functions in actions use camelCase consistently (`createTree`, `updateMember`, `deleteRelationship`, `getBirthdayReminders`).

However, interfaces and types use `snake_case` for properties that map to database columns (e.g., `tree_id`, `first_name`, `date_of_birth`, `from_member_id`). This is intentional -- it mirrors the Supabase/PostgreSQL column names. While this avoids a mapping layer, it means TypeScript code mixes `camelCase` function names with `snake_case` property access throughout. This is a deliberate trade-off, not a bug.

#### 6. Type file naming: consistent -- PASS

Type files in `src/types/` use kebab-case singular names: `tree.ts`, `member.ts`, `relationship.ts`, `document.ts`, `timeline.ts`.

---

### Type Safety Issues

#### 1. Zero `any` types -- PASS

A grep for `: any`, `<any>`, and `as any` across all `src/**/*.{ts,tsx}` returned **zero matches**. This is excellent.

#### 2. Heavy use of type assertions (`as Type`) -- 120+ instances

There are approximately 120+ type assertions across the codebase. The breakdown by category:

**Supabase response casting (majority, ~60 instances):** Nearly every server action casts Supabase `.data` responses:

```typescript
return data as TreeMember;
return (data ?? []) as Relationship[];
return data as FamilyTree | null;
```

This is a systemic pattern caused by Supabase's generic return types. These assertions are generally safe but could be replaced by using Supabase's generated types or a typed query helper.

**Realtime payload casting (~15 instances in tree-canvas.tsx):**

```typescript
const row = (payload.new ?? payload.old) as TreeMember;
const cursor = payload as CollaboratorCursor;
```

These are riskier because realtime payloads have no compile-time guarantees.

**Form value casting (~8 instances):**

```typescript
v as CreateMemberFormValues["gender"];
v as RelationshipType;
v as TreeRole;
```

These come from Radix UI `Select` components that return `string`. Unavoidable without wrapper components.

**ReactFlow node/edge data casting (~20 instances in tree-canvas.tsx):**

```typescript
node.data as TreeMember;
edge.data as RelationshipEdgeData | undefined;
```

These are inherent to the ReactFlow API which uses generic `Record<string, unknown>` for node data.

**Recommendation:** Create a typed Supabase query wrapper (e.g., `typedQuery<T>(query)`) to eliminate the ~60 Supabase assertions. Add runtime validation (Zod `.parse()`) for realtime payloads.

#### 3. Return types on exported functions -- IMPLICIT everywhere

No exported server action function has an explicit return type annotation. They all rely on TypeScript inference:

```typescript
export async function createTree(name: string, description?: string) {
  // return type is inferred
}
```

While TypeScript can infer these, explicit return types on exported functions serve as documentation and catch accidental return type changes.

#### 4. Zod schema alignment

Validators exist in `src/lib/validators/` with Zod schemas for `member`, `tree`, `relationship`, `invite`, `document`, `profile`. The TypeScript types in `src/types/` are manually defined interfaces, not inferred from Zod schemas (`z.infer<typeof schema>`). This means the Zod schemas and TypeScript types could drift apart without any compile-time warning.

---

### Module Structure Issues

#### 1. Barrel export exists but is incomplete

`src/types/index.ts` exports from all 5 type files:

```typescript
export * from "./tree";
export * from "./member";
export * from "./relationship";
export * from "./document";
export type { TimelineEvent, TimelineEventType } from "./timeline";
```

The timeline export is selective (named exports only), while others use wildcard re-exports. This inconsistency is minor but worth noting.

**Missing barrel exports:** There is no barrel for `src/lib/actions/`, `src/lib/validators/`, `src/lib/hooks/`, or `src/lib/utils/`. Each consumer must import from the specific file.

#### 2. Import alias usage: strong but not universal

- **419 imports** use the `@/` path alias across 115 files.
- **27 relative `../` imports** exist across 19 files.

All 27 relative imports are in `__tests__/` directories importing from their parent module (e.g., `from "../permissions"`). This is acceptable -- test files importing their subject via `../` is a common convention. No `../../` (two-level-deep) relative imports were found anywhere, which is clean.

#### 3. Circular dependency risks

The action files have a potential circular dependency pattern:

- `permissions.ts` imports from `@/types`
- `member.ts` imports from `@/types`
- `permission-integration.test.ts` imports from both `../permissions` and `../member`

However, since no action file imports another action file at runtime (only tests cross-import), there is no actual circular dependency. The architecture is clean in this regard.

#### 4. Types exported from action files

Multiple action files export their own interfaces alongside functions:

| Action file       | Exported interfaces                                                              |
| ----------------- | -------------------------------------------------------------------------------- |
| `permissions.ts`  | `TreePermissions`, `NodeProfileLink`, `NodeMembership`, `MembershipWithActivity` |
| `audit.ts`        | `AuditLogEntry`, `TreeSnapshot`, `AuditLogOptions`                               |
| `notification.ts` | `Notification`                                                                   |
| `merge.ts`        | `ConflictResolution`, `MergeConflict`, `MemberMapping`                           |
| `member.ts`       | `MemberWithStats`                                                                |
| `birthday.ts`     | `BirthdayReminder`                                                               |
| `tree-health.ts`  | `TreeHealthData`                                                                 |
| `tree-stats.ts`   | `TreeStats`                                                                      |
| `invite.ts`       | `Invitation`                                                                     |
| `profile.ts`      | `Profile`                                                                        |
| `share.ts`        | `PublicRelationship`                                                             |
| `photo.ts`        | `Media`                                                                          |

These 18+ interfaces are defined in action files rather than in `src/types/`. This makes them harder to discover and means the `src/types/` barrel export is incomplete -- consumers must know which action file defines which type. These should be migrated to `src/types/` and re-exported through the barrel.

---

### Error Handling Inconsistencies

#### 1. Consistent `throw new Error()` pattern -- mostly PASS

All 18 server action files use `throw new Error(...)` for error conditions. There are **zero `try/catch` blocks** in the action files themselves -- errors propagate to the caller. This is consistent.

Total `throw new Error` calls across action files: **~170 instances**.

#### 2. Mixed return patterns for "not found"

Most actions throw on failure, but 4 cases silently return `null`:

| File                 | Line                                 | Pattern                          |
| -------------------- | ------------------------------------ | -------------------------------- |
| `profile.ts:22`      | `if (!userId) return null;`          | Returns null instead of throwing |
| `invite.ts:127`      | `if (error \|\| !data) return null;` | Returns null on lookup failure   |
| `permissions.ts:250` | `if (!data) return null;`            | Returns null when no membership  |
| `member.ts:270`      | `if (error) return null;`            | Returns null on fetch error      |

These silent failures make it impossible for the caller to distinguish "not found" from "error occurred." The `member.ts:270` case is particularly concerning -- a database error is swallowed.

#### 3. Error messages are developer-facing, not user-facing

Error messages like `"Failed to fetch members: ${error.message}"` and `"Failed to create relationship: ${error.message}"` expose Supabase error details. These are fine for server-side logging but should not be shown to end users directly. There is no error mapping layer between server actions and UI.

#### 4. No centralized error boundary

There is no `error.tsx` file anywhere in the `src/app/` directory tree. Next.js App Router supports per-route error boundaries via `error.tsx` files. Without these, unhandled errors in server components will show the default Next.js error page.

#### 5. No `not-found.tsx` handlers

Similarly, no `not-found.tsx` files exist for custom 404 handling on dynamic routes like `tree/[id]` or `member/[memberId]`.

---

### Component Pattern Issues

#### 1. Function declaration style: consistent -- PASS

All 48 exported components use named `function` declarations:

```typescript
export function TreeCanvas(props: TreeCanvasProps) { ... }
export function MemberDetailPanel({ ... }: MemberDetailPanelProps) { ... }
```

No arrow function components were found among exports.

#### 2. Client/server boundary directives: thorough -- PASS

- All 18 action files have `"use server"` at the top.
- All interactive components have `"use client"` at the top (79 files).
- The Supabase client (`src/lib/supabase/client.ts`) correctly has `"use client"`.
- Server-only files like page components and layout files correctly omit the directive (they are server components by default).

#### 3. Prop drilling concerns

Without reading every component in full, the tree page ecosystem (`tree/[id]/page.tsx`) passes data through to `TreeCanvas`, which at 1,537 lines manages its own state internally. The `TreeCanvas` component appears to be a "god component" that handles:

- Node/edge state management
- Realtime subscription and collaboration cursors
- Layout computation (dagre)
- Undo/redo
- Context menus
- Search
- Member detail panel toggling
- Drag and drop

This should use React context or a state management solution to avoid the massive single-component problem.

#### 4. Custom hooks: well-extracted but sparse

Three custom hooks exist:

- `use-realtime-tree.ts` -- realtime subscriptions
- `use-tree-permissions.ts` -- permission checking
- `use-undo-redo.ts` -- undo/redo state

Given the complexity of `tree-canvas.tsx`, additional hooks should be extracted for: collaboration/cursor state, node layout state, and canvas interaction handlers.

---

### Tooling Recommendations

#### 1. ESLint configuration is minimal

The current `eslint.config.mjs` only extends `next/core-web-vitals` and `next/typescript`. It adds no custom rules. This means:

- No enforcement of explicit return types on exports
- No prevention of `any` types (currently clean, but not enforced)
- No import ordering rules
- No unused variable strictness beyond TypeScript defaults
- No complexity limits

#### 2. No Prettier configuration

No `.prettierrc`, `prettier.config.*`, or prettier entry in `package.json` was found. Code formatting is not enforced by tooling. The codebase appears manually consistent, but this will drift over time.

#### 3. No pre-commit hooks

No `husky`, `lint-staged`, or similar pre-commit tooling is configured. Lint and format checks only run if developers remember to run them manually (or in CI).

#### 4. TypeScript strictness: enabled -- PASS

`tsconfig.json` has `"strict": true`, which enables all strict type-checking options. This is good.

#### 5. Vitest configuration is clean -- PASS

`vitest.config.ts` correctly configures jsdom environment, the `@/` path alias, and includes both `src/` and `tests/` directories. The setup file at `src/test-setup.ts` exists.

#### 6. Both `package-lock.json` and `bun.lock` exist

Having two lock files suggests the project has been used with both npm and bun. This can cause dependency version mismatches. Pick one package manager and remove the other lock file.

---

### Proposed ESLint Rules to Prevent Future Issues

```jsonc
// Recommended additions to eslint.config.mjs
{
  // Enforce explicit return types on exported functions
  "@typescript-eslint/explicit-function-return-type": [
    "warn",
    {
      "allowExpressions": true,
      "allowTypedFunctionExpressions": true,
      "allowHigherOrderFunctions": true,
    },
  ],

  // Prevent any types from creeping in
  "@typescript-eslint/no-explicit-any": "error",

  // Warn on type assertions (encourages type guards)
  "@typescript-eslint/consistent-type-assertions": [
    "warn",
    {
      "assertionStyle": "as",
      "objectLiteralTypeAssertions": "never",
    },
  ],

  // Enforce consistent imports
  "import/order": [
    "warn",
    {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
    },
  ],

  // Catch unused variables
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_",
    },
  ],

  // Limit file complexity
  "max-lines": ["warn", { "max": 500, "skipBlankLines": true, "skipComments": true }],
  "complexity": ["warn", 20],

  // Enforce consistent function style for components
  "react/function-component-definition": [
    "warn",
    {
      "namedComponents": "function-declaration",
    },
  ],

  // Catch missing error boundaries
  "react/jsx-no-leaked-render": "warn",
}
```

---

### Summary of Findings

| Category           | Status     | Critical Issues                                     | Warnings                                            |
| ------------------ | ---------- | --------------------------------------------------- | --------------------------------------------------- |
| File Organization  | Needs work | 2 files over 500 lines (up to 3x limit)             | 3 misplaced root files, test location inconsistency |
| Naming Conventions | Good       | None                                                | snake_case DB mapping is a deliberate trade-off     |
| Type Safety        | Mixed      | 120+ type assertions, no explicit return types      | Zero `any` types (excellent)                        |
| Module Structure   | Needs work | 18+ types defined in action files, not `src/types/` | No barrel exports for actions/validators/hooks      |
| Error Handling     | Needs work | No error boundaries, 4 silent null returns          | ~170 throws with dev-facing messages                |
| Component Patterns | Needs work | `tree-canvas.tsx` is a 1,537-line god component     | Sparse component test coverage (1/48)               |
| Tooling            | Needs work | No Prettier, no pre-commit hooks                    | ESLint config has zero custom rules                 |

**Top 5 action items by impact:**

1. **Decompose `tree-canvas.tsx`** (1,537 lines) into 4-5 focused modules with extracted hooks and context
2. **Add Next.js error boundaries** (`error.tsx`, `not-found.tsx`) at minimum for `app/`, `app/tree/[id]/`, and `app/(dashboard)/`
3. **Move type definitions** from action files to `src/types/` and export through the barrel
4. **Add Prettier + lint-staged + husky** for automated formatting and pre-commit linting
5. **Add ESLint rules** for `max-lines`, `no-explicit-any`, and `explicit-function-return-type` to prevent regression
