## Code Quality Audit Report

**Date:** 2026-03-28
**Scope:** All `.ts` and `.tsx` files under `src/`
**Files Analyzed:** 180
**Total Lines of Code:** 26,378

---

### Summary

- **Overall Quality Score:** 6.5/10
- **TypeScript Errors:** 7 (all in test files -- stale type mocks)
- **Lint Warnings:** 15, Lint Errors: 1
- **Console Statements in Production Code:** 6
- **Potentially Unused Exports:** 35
- **Files Exceeding 500 Lines:** 3 (one exceeds 1,500)
- **Functions Exceeding 50 Lines:** 22
- **Technical Debt Estimate:** ~16-20 hours

---

### Critical (must fix)

1. **[src/lib/actions/share.ts:1] Missing `"use server"` directive**
   Every other file in `src/lib/actions/` has `"use server"` as the first line. `share.ts` is missing it. Since its functions are likely called from client components, this means they execute on the client, leaking the `createAdminClient` import (Supabase service-role key) into the client bundle. This is a **security-critical** issue.

2. **[src/components/tree/member-node.tsx:67] Missing `aria-selected` on `role="treeitem"`**
   The element has `role="treeitem"` but lacks the required `aria-selected` attribute. This is an accessibility violation (WCAG failure) flagged by the linter.

3. **[tests/e2e/fixtures.ts:3] Empty object type `{}`**
   Using `{}` as a type allows any non-nullish value. Should use `object` or `Record<string, unknown>` instead. This is the only lint error in the project.

4. **[7 test files] Stale `TreeMember` type mocks**
   The `TreeMember` type was extended with `birth_year`, `birth_month`, `birth_day`, `death_year`, and 2 more fields, but 5 test files still use the old shape, causing `tsc --noEmit` to fail:
   - `src/components/permissions/__tests__/permission-manager.test.tsx:73`
   - `src/lib/utils/__tests__/gedcom-exporter.test.ts:6`
   - `src/lib/utils/__tests__/gedcom-extended-relationships.test.ts:7`
   - `src/lib/utils/__tests__/performance.test.ts:11`
   - `src/lib/utils/tree-layout.test.ts:6`

   Additionally, `FamilyArcData` is missing a `relationship_type` property accessed in:
   - `src/lib/utils/__tests__/performance.test.ts:175`
   - `src/lib/utils/tree-layout.test.ts:78`

---

### High (should fix)

5. **[src/components/tree/tree-canvas.tsx] God object -- 1,537 lines**
   This is the largest file in the project by a wide margin. It exceeds the 500-line threshold by 3x. It likely handles rendering, event handling, state management, layout, and interactions all in one component. Should be decomposed into smaller, focused modules.

6. **[src/components/tree/member-detail-panel.tsx] God object -- 1,432 lines**
   Second largest file. Contains multiple inner components and duplicate state declarations (e.g., `saving` state declared twice at lines 116 and 252). Should be split into sub-components.

7. **[src/lib/actions/permissions.ts] Large file -- 526 lines**
   Exceeds the 500-line project guideline.

8. **[src/components/tree/member-detail-panel.tsx:12] Unused import: `Check`**
   The `Check` icon from `lucide-react` is imported but never rendered in JSX. Only `UserCheck` and `CheckCircle` variants are used. Flagged by ESLint.

9. **[src/components/tree/member-detail-panel.tsx:116] Unused `saving` state (first declaration)**
   The variable `saving` at line 116 is declared and `setSaving` is called, but the `saving` boolean at that scope is never read to gate UI. ESLint flags it as assigned but never used. This suggests dead or incomplete logic.

10. **[22 functions exceeding 50 lines]**
    The following functions are oversized and should be broken into smaller units:

    | Lines | Function                         | File                                       |
    | ----- | -------------------------------- | ------------------------------------------ |
    | 232   | `getTreeStats`                   | `src/lib/actions/tree-stats.ts`            |
    | 156   | `mergeTree`                      | `src/lib/actions/merge.ts`                 |
    | 151   | `createRelationship`             | `src/lib/actions/relationship.ts`          |
    | 136   | `getTimelineEvents`              | `src/lib/actions/timeline.ts`              |
    | 133   | `exportGedcom`                   | `src/lib/utils/gedcom-exporter.ts`         |
    | 129   | `getAuditLog`                    | `src/lib/actions/audit.ts`                 |
    | 126   | `getNotifications`               | `src/lib/actions/notification.ts`          |
    | 123   | `parseGedcom`                    | `src/lib/utils/gedcom-parser.ts`           |
    | 123   | `computeTreeLayout`              | `src/lib/utils/tree-layout.ts`             |
    | 100   | `uploadPhoto`                    | `src/lib/actions/photo.ts`                 |
    | 98    | `importGedcomData`               | `src/lib/actions/import.ts`                |
    | 96    | `uploadDocument`                 | `src/lib/actions/document.ts`              |
    | 87    | `parseIndi`                      | `src/lib/utils/gedcom-parser.ts`           |
    | 75    | `rollbackToSnapshot`             | `src/lib/actions/audit.ts`                 |
    | 72    | `updateRelationship`             | `src/lib/actions/relationship.ts`          |
    | 72    | `calculateRelationship`          | `src/lib/utils/relationship-calculator.ts` |
    | 61    | `buildFamilies`                  | `src/lib/utils/gedcom-exporter.ts`         |
    | 61    | `getTreeHealth`                  | `src/lib/actions/tree-health.ts`           |
    | 59    | `createInvite`                   | `src/lib/actions/invite.ts`                |
    | 59    | `findPath`                       | `src/lib/utils/path-finder.ts`             |
    | 58    | `acceptInvite`                   | `src/lib/actions/invite.ts`                |
    | 57    | `getTreeMembershipsWithActivity` | `src/lib/actions/permissions.ts`           |

11. **[35 potentially unused exports]**
    The following exported symbols are not imported by any other non-test file. Some are legitimately used by Next.js conventions (e.g., `POST`, `runtime`) or are entry points from pages, but many appear to be dead code:

    **Likely dead code (no external consumer found):**
    - `sanitizeForLLM` in `src/lib/sanitize.ts` (AI safety function defined but never wired in)
    - `formatDateShort`, `composePartialDate`, `formatPartialDate`, `formatPartialYear` in `src/lib/utils/date.ts`
    - `normalizeGedcomDate` in `src/lib/utils/gedcom-parser.ts`
    - `findOrphanNodes`, `validateTreeDepth`, `findAffectedRelationships` in `src/lib/validators/graph.ts`
    - `rateLimitAsync` in `src/lib/rate-limit.ts`
    - `documentTypeEnum`, `UploadDocumentInput`, `UpdateDocumentInput` in `src/lib/validators/document.ts`
    - `acceptInviteSchema`, `AcceptInviteInput` in `src/lib/validators/invite.ts`
    - `updateMemberLinkedNode` in `src/lib/actions/permissions.ts`
    - `MemberFormData` interface in `src/types/member.ts`
    - `UndoableAction` interface in `src/lib/hooks/use-undo-redo.ts`

    **Likely used by framework/runtime (false positives -- do NOT remove):**
    - `POST` in `src/app/api/webhooks/clerk/route.ts` (Next.js route handler)
    - `runtime` in `src/app/opengraph-image.tsx` (Next.js edge runtime config)
    - `BirthdayReminderBanner`, `EmptyState`, `PageSkeleton`, `CardSkeleton` (may be used in JSX)
    - `createServerClient`, `withUserContext` in `src/lib/supabase/server.ts` (used by server actions)
    - `useRealtimeTree`, `useTreePermissions` (used in client components)

12. **[src/components/tree/tree-canvas.tsx:172] Unnecessary `useCallback` dependency**
    `permissions.linkedNodeId` is listed as a dependency but is not needed. ESLint warns this can cause unnecessary re-renders.

13. **[src/components/tree/tree-canvas.tsx:503] Missing `useEffect` dependency**
    The `router` variable is used inside a `useEffect` but missing from the dependency array, which can cause stale closures.

---

### Medium (nice to fix)

14. **[14 action files] Magic numbers in rate-limit calls**
    Rate limit parameters are inlined as magic numbers across 14 call sites (e.g., `rateLimit(userId, 'createMember', 20, 60_000)`). These should be extracted into a shared constants file like `RATE_LIMITS.createMember = { max: 20, windowMs: 60_000 }`.

    Affected files: `tree.ts`, `member.ts`, `relationship.ts`, `document.ts`, `photo.ts`, `invite.ts`, `import.ts`

15. **[6 files] `console.error` statements in production code**
    While `console.error` is more acceptable than `console.log`, these should use a structured logger for production observability:
    - `src/lib/rate-limit.ts:71` -- `console.error("[rate-limit] Redis error:", err)`
    - `src/lib/actions/photo.ts:79` -- `console.error("Photo upload failed:", ...)`
    - `src/lib/actions/photo.ts:110` -- `console.error("Failed to save photo record:", ...)`
    - `src/lib/actions/document.ts:86` -- `console.error("Document upload failed:", ...)`
    - `src/lib/actions/document.ts:109` -- `console.error("Failed to save document record:", ...)`
    - `src/app/api/webhooks/clerk/route.ts:68` -- `console.error("Failed to sync profile:", error)`

16. **[20 files] Missing `import type` where applicable**
    68 files use `import type`, which is good. However, 20 production files import only types from modules using value imports. Examples:
    - `src/lib/actions/audit.ts`
    - `src/lib/actions/auth.ts`
    - `src/lib/actions/birthday.ts`
    - `src/lib/actions/invite.ts`
    - `src/lib/actions/notification.ts`
    - `src/lib/actions/photo.ts`
    - `src/lib/actions/profile.ts`
    - `src/lib/actions/tree-health.ts`
    - `src/lib/actions/tree-stats.ts`
    - `src/lib/utils/date.ts`
    - `src/components/tree/couple-block-node.tsx`
    - `src/components/tree/empty-tree-state.tsx`
    - `src/components/tree/tree-health-bar.tsx`
    - `src/components/tree/tree-sidebar.tsx`
    - `src/components/tree/tree-stats.tsx`

    Using `import type` for type-only imports enables better tree-shaking and faster builds.

17. **[3 React Hook Form warnings] Compiler compatibility**
    React Hook Form's `watch()` is flagged by the React Compiler as unmemoizable. Affected files:
    - `src/components/tree/add-member-dialog.tsx:72`
    - `src/components/tree/add-relationship-dialog.tsx:73`
    - `src/components/tree/edit-member-dialog.tsx:64`

    This is not a bug today, but will become an issue if the React Compiler is enabled for production.

18. **[4 test files] Unused imports in test files**
    - `src/lib/actions/__tests__/permission-integration.test.ts:41` -- `deleteRelationship` imported but never used
    - `src/lib/actions/__tests__/permission-integration.test.ts:44` -- `updateMemberRole` imported but never used
    - `src/lib/utils/__tests__/performance.test.ts:290` -- `allTypes` assigned but never read (second declaration)
    - `tests/e2e/collaboration.spec.ts:1` -- `expect` imported but never used
    - `tests/e2e/import-export.spec.ts:1` -- `expect` imported but never used
    - `tests/e2e/tree-visualization.spec.ts:1` -- `expect` imported but never used
    - `tests/e2e/public-share.spec.ts:5` -- `response` assigned but never used

19. **[src/types/index.ts] Wildcard re-exports**
    4 of 5 type modules use `export *` which can make it harder to trace where types originate and risks future circular dependency issues. The `timeline` module correctly uses a named `export type` -- the others should follow suit.

---

### Low (cosmetic)

20. **[src/lib/actions/share.ts] Inconsistent `"use server"` pattern**
    Even though this file is missing the directive entirely (listed as Critical above), the inconsistency itself is worth noting: 17 of 18 action files have it, making this an obvious oversight.

21. **[src/lib/sanitize.ts] `sanitizeForLLM` is defined but never called**
    The CLAUDE.md AI Safety Policy (Stream 31c) mandates using `sanitizeForLLM` on all user-supplied text before passing to LLM context. The function exists but has zero call sites. This is either premature code or an incomplete security control.

22. **[src/lib/validators/graph.ts] Utility functions with no consumers**
    `findOrphanNodes`, `validateTreeDepth`, and `findAffectedRelationships` are exported but unused. These may have been written for future features but represent dead code today (191 lines).

23. **Import grouping is mostly consistent**
    Most files follow the pattern: React/Next.js imports, then external libraries, then `@/` internal imports, then relative imports, then types. A few files deviate, but this is a minor cosmetic issue.

24. **No TODO/FIXME/HACK comments found**
    No deferred-work markers exist in the source code. This is either good discipline or indicates that technical debt is not being tracked inline.

---

### Patterns to Enforce Going Forward

1. **Enforce `"use server"` linting**
   Add an ESLint rule or custom lint script that verifies all files in `src/lib/actions/*.ts` begin with `"use server"`. Missing this directive can leak server-only code (including secrets) to the client bundle.

2. **Extract rate-limit constants**
   Create `src/lib/constants/rate-limits.ts` with named configurations. Replace all 14 inline `rateLimit(userId, name, max, window)` calls with `rateLimit(userId, RATE_LIMITS.createMember)`.

3. **Enforce max file length (500 lines)**
   Add an ESLint `max-lines` rule set to 500. The three files over 500 lines (`tree-canvas.tsx` at 1,537, `member-detail-panel.tsx` at 1,432, `permissions.ts` at 526) should be refactored first.

4. **Enforce max function length (50 lines)**
   Add an ESLint `max-lines-per-function` rule. 22 functions currently exceed this threshold, with the worst offender at 232 lines.

5. **Prefer `import type` for type-only imports**
   Enable the TypeScript ESLint rule `@typescript-eslint/consistent-type-imports` to auto-fix value imports that should be type imports.

6. **Replace `console.error` with a structured logger**
   Create a lightweight logger wrapper (`src/lib/logger.ts`) that can be swapped between `console` in development and a structured logging service (e.g., Pino, winston) in production.

7. **Keep test mocks in sync with types**
   Consider creating shared test factory functions (e.g., `createMockMember()`) in a `src/test-utils/factories.ts` file rather than hand-crafting mock objects in every test. This way, when `TreeMember` gains new fields, only the factory needs updating.

8. **Wire in `sanitizeForLLM`**
   Per the AI Safety Policy in CLAUDE.md, audit all code paths where user text (member bios, tree names, document descriptions) could reach an LLM context and insert `sanitizeForLLM` calls. Currently the function exists but is unused.

9. **Accessibility enforcement**
   The missing `aria-selected` on `role="treeitem"` suggests ARIA rules are not being caught during development. Ensure `jsx-a11y` ESLint plugin is configured with `"error"` severity (not just `"warn"`) for required-aria-props rules.
