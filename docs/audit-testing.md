## Test Coverage & Quality Audit

**Date:** 2026-03-28
**Auditor:** QA Agent (automated)
**Scope:** `src/lib/actions/`, `src/components/`, `src/lib/validators/`, `tests/`, supporting utilities

---

### Coverage Summary

| Area                                  | Files | Tested | Untested | Coverage %                   |
| ------------------------------------- | ----- | ------ | -------- | ---------------------------- |
| `src/lib/actions/` (server actions)   | 16    | 10     | 6        | 62.5%                        |
| `src/components/` (non-UI primitives) | 44    | 1      | 43       | 2.3%                         |
| `src/lib/validators/`                 | 7     | 6      | 1        | 85.7%                        |
| `src/lib/utils/` (utilities)          | 8     | 7      | 1        | 87.5%                        |
| `src/lib/hooks/`                      | 2     | 1      | 1        | 50.0%                        |
| `tests/security/`                     | 5     | 5      | 0        | 100%                         |
| `tests/validation/`                   | 3     | 3      | 0        | 100%                         |
| `tests/e2e/`                          | 6     | 6      | 0        | 100% (but see quality notes) |
| `tests/a11y/`                         | 1     | 1      | 0        | 100% (but see quality notes) |
| `tests/actions/`                      | 1     | 1      | 0        | 100%                         |

---

### 1. Untested Files (Explicit List)

#### Untested Server Actions (`src/lib/actions/`)

| File              | Risk     | Notes                                                                            |
| ----------------- | -------- | -------------------------------------------------------------------------------- |
| `auth.ts`         | **HIGH** | Auth bootstrapping, no tests at all                                              |
| `profile.ts`      | **HIGH** | Profile sync/creation, only mocked by other tests                                |
| `tree-health.ts`  | MEDIUM   | Tree health scoring, no unit tests                                               |
| `timeline.ts`     | LOW      | Has tests in `tests/tree/timeline.test.ts` and `timeline-events.test.ts`         |
| `tree-stats.ts`   | LOW      | Has tests in `tests/tree/tree-stats.test.ts` and `tree-stats-edge-cases.test.ts` |
| `notification.ts` | MEDIUM   | No tests found                                                                   |
| `audit.ts`        | MEDIUM   | Audit log writes, no direct tests                                                |
| `photo.ts`        | **HIGH** | File upload/delete with storage, no tests                                        |
| `import.ts`       | **HIGH** | GEDCOM import with rate limiting and validation, no action-level tests           |

Note: `timeline.ts` and `tree-stats.ts` have partial coverage via files in `tests/tree/`. The remaining 6 action files (auth, profile, tree-health, notification, audit, photo, import) have zero test coverage.

#### Untested Components (`src/components/`)

Only 1 of 44 non-UI-primitive components has tests (`permission-manager.tsx`). Every other component is untested:

**Tree components (highest risk -- core UI):**

- `tree-canvas.tsx`, `member-node.tsx`, `couple-block-node.tsx`, `member-detail-panel.tsx`
- `tree-toolbar.tsx`, `tree-sidebar.tsx`, `tree-search.tsx`
- `add-member-dialog.tsx`, `edit-member-dialog.tsx`, `add-relationship-dialog.tsx`
- `node-context-menu.tsx`, `member-profile.tsx`, `members-list.tsx`
- `relationship-edge.tsx`, `family-arc-edge.tsx`
- `tree-stats.tsx`, `tree-health-bar.tsx`, `timeline-view.tsx`
- `birthday-reminder-banner.tsx`, `tree-settings-form.tsx`, `merge-tree-dialog.tsx`
- `empty-tree-state.tsx`

**Dashboard components:**

- `dashboard-header.tsx`, `tree-card.tsx`, `create-tree-dialog.tsx`, `join-tree-dialog.tsx`

**Document/Photo components:**

- `document-upload.tsx`, `document-list.tsx`, `document-viewer.tsx`, `document-type-badge.tsx`
- `photo-upload.tsx`, `photo-gallery.tsx`

**Import/Export components:**

- `gedcom-import-dialog.tsx`, `gedcom-export-button.tsx`, `tree-image-export.tsx`

**Other components:**

- `invite-manager.tsx`, `accept-invite-card.tsx`
- `notification-bell.tsx`
- `history-client.tsx`, `snapshot-viewer.tsx`, `rollback-dialog.tsx`, `audit-timeline.tsx`
- `header.tsx`, `footer.tsx`, `user-menu.tsx`, `theme-toggle.tsx`, `providers.tsx`
- `loading-skeleton.tsx`, `empty-state.tsx`, `confirm-dialog.tsx`
- `profile/tree-visual-settings.tsx`

#### Untested Validators

| File                 | Status                                                |
| -------------------- | ----------------------------------------------------- |
| `temporal.ts`        | Tested (tests/validation/temporal-invariants.test.ts) |
| `cycle-detection.ts` | Tested (tests/validation/cycle-detection.test.ts)     |
| `graph.ts`           | Tested (tests/validation/graph-validation.test.ts)    |
| `tree.ts`            | Tested (src/lib/validators/tree.test.ts)              |
| `member.ts`          | Tested (src/lib/validators/member.test.ts)            |
| `relationship.ts`    | Tested (src/lib/validators/relationship.test.ts)      |
| `invite.ts`          | Tested (src/lib/validators/invite.test.ts)            |
| `document.ts`        | Tested (src/lib/validators/document.test.ts)          |
| `profile.ts`         | Tested (src/lib/validators/profile.test.ts)           |

Validators have strong coverage overall.

#### Untested Hooks

| File                      | Status                                        |
| ------------------------- | --------------------------------------------- |
| `use-undo-redo.ts`        | Tested                                        |
| `use-realtime-tree.ts`    | **UNTESTED** -- real-time subscription logic  |
| `use-tree-permissions.ts` | **UNTESTED** -- client-side permission checks |

#### Untested Utilities

| File                         | Status                                    |
| ---------------------------- | ----------------------------------------- |
| `cn.ts`                      | UNTESTED (trivial clsx wrapper, low risk) |
| `photo-url.ts`               | UNTESTED (URL construction, medium risk)  |
| `date.ts`                    | Tested                                    |
| `gedcom-parser.ts`           | Tested                                    |
| `gedcom-exporter.ts`         | Tested                                    |
| `path-finder.ts`             | Tested                                    |
| `relationship-calculator.ts` | Tested                                    |
| `tree-layout.ts`             | Tested                                    |

---

### 2. Critical Gaps (Must Add Tests)

**Priority 1 -- Security/Auth:**

1. **`src/lib/actions/auth.ts`** -- Zero tests for the authentication bootstrap. This is the gateway for every server action. Must test: unauthenticated access rejection, Clerk session validation, profile sync.
2. **`src/lib/actions/import.ts`** -- Handles user file uploads (GEDCOM). No action-level tests. Rate limiting and file validation are critical attack surfaces.
3. **`src/lib/actions/photo.ts`** -- Handles file upload to Supabase Storage. No tests for: file size limits, MIME type validation, storage path sanitization, unauthorized access.
4. **Middleware** -- No middleware.ts file found. If auth is handled via Clerk middleware, there should be tests verifying route protection.

**Priority 2 -- Data Integrity:** 5. **`src/lib/actions/profile.ts`** -- Profile creation/sync is mocked everywhere but never tested itself. If `ensureProfile` fails silently, all downstream actions break. 6. **`src/lib/actions/notification.ts`** -- No tests. Silent failures here mean users miss important events. 7. **`src/lib/actions/audit.ts`** -- Audit log is referenced in merge tests but never directly tested.

**Priority 3 -- Core UI:** 8. **`tree-canvas.tsx`** -- The central UI component. Zero tests. 9. **`member-node.tsx` / `couple-block-node.tsx`** -- Core rendering nodes, untested. 10. **Dialog components** (`add-member-dialog`, `edit-member-dialog`, `merge-tree-dialog`, `create-tree-dialog`) -- User-facing forms with validation, all untested.

---

### 3. Quality Issues (Tests That Need Improvement)

#### 3a. Useless/Always-Passing Tests

| File                             | Issue                                                                                                                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/a11y/components.test.tsx` | **CRITICAL: `expect(true).toBe(true)`** -- This test always passes regardless. It is a placeholder that provides zero value. The comment says "This is a placeholder" which confirms it.                                                                             |
| `tests/e2e/tree-crud.spec.ts`    | 4 of 5 tests are empty stubs. They navigate to `/dashboard` and call `waitForHydration` but assert nothing. Only the first test checks for button visibility. The entire suite is `test.skip`-gated on `E2E_TEST_EMAIL` so it never runs in CI without that env var. |

#### 3b. Tests Testing Implementation Details

| File                                            | Issue                                                                                                                                                                                                                        |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/actions/__tests__/tree.test.ts`        | Tests assert `client.from` was called with specific table names (`"family_trees"`, `"tree_memberships"`). These are implementation details -- if the schema changes the table name, tests break even if behavior is correct. |
| `src/lib/actions/__tests__/permissions.test.ts` | Uses `callCount` tracking on `mockClient.from` to distinguish first/second/third calls. This is fragile -- any refactor that changes call order breaks tests even if behavior is correct.                                    |

#### 3c. Insufficient Error Path Coverage

| File                   | Gap                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tree.test.ts`         | Tests `deleteTree` rejection for non-owner but never tests successful deletion. No test for: delete when tree has members (cascade behavior), delete when tree has active invites. |
| `member.test.ts`       | `deleteMember` only tests viewer rejection. No test for successful deletion, deletion of member with relationships (cascade), or deletion of last member.                          |
| `relationship.test.ts` | `deleteRelationship` only tests non-owner rejection. No success path test. `getRelationshipsByTreeId` only tests no-access. No test for successful retrieval or empty tree.        |
| `invite.test.ts`       | `revokeInvite` only tests non-owner rejection. No success path test.                                                                                                               |
| `share.test.ts`        | `getPublicRelationships` has no error path test (private tree, DB error).                                                                                                          |

#### 3d. Edge Cases Not Covered

| Area            | Missing Edge Case                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Member creation | Empty string first_name (only whitespace), extremely long names (>255 chars), Unicode/emoji names, XSS in name fields |
| Tree creation   | Unicode tree names, SQL injection in description field                                                                |
| Relationship    | Creating relationship between members in different trees                                                              |
| Birthday        | Leap year birthdays (Feb 29), timezone edge cases around midnight                                                     |
| Merge           | Merging tree with 0 members, merging tree with circular relationships                                                 |
| Documents       | Upload with 0-byte file, upload with filename containing path traversal                                               |
| Invite          | Concurrent acceptance race condition (two users accept last-use invite simultaneously)                                |

---

### 4. Mock Issues

#### 4a. Supabase Mock Realism

**Concern: Chainable mock builder does not match real Supabase API.** The `createMockSupabaseClient` in `setup.ts` creates a flat chain where every method returns `this`. The real Supabase client has different return types per method:

- `.single()` returns `PostgrestSingleResponse<T>` (with `data` and `error`)
- `.select()` returns a `PostgrestFilterBuilder`
- The mock conflates these, meaning tests can pass even if the code chains methods incorrectly

**Specific issues:**

- `builder.rpc` is mocked as a direct function on the builder, but in the real client `rpc` is on the top-level client, not on the query builder
- `builder.in` is mocked but the real Supabase `.in()` requires a column name as the first argument -- tests never verify column names
- Storage mock in `document.test.ts` (`makeMockStorage`) is reasonably accurate

#### 4b. Mocks That Are Too Permissive

| File               | Issue                                                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setup.ts`         | `createMockSupabaseClient` returns `mockReturnThis()` for ALL chain methods. This means tests will never catch cases where the wrong method is called in the chain. |
| `share.test.ts`    | Supabase admin mock has no `rpc` property. If `share.ts` ever calls `rpc`, the test would crash rather than gracefully fail.                                        |
| `birthday.test.ts` | Mocks `assertUUID` as a no-op (`vi.fn()`). This means the test never validates that UUIDs are checked -- a malformed UUID would pass through.                       |
| `merge.test.ts`    | Mocks `sanitizeText` as identity function `(s: string) => s`. This means XSS in tree names during merge would not be caught by tests.                               |

#### 4c. Clerk Auth Mock Consistency

Clerk is mocked consistently across all test files with the same pattern:

```typescript
vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn().mockResolvedValue({ userId: "user-123" }),
  currentUser: vi.fn().mockResolvedValue({ ... }),
}));
```

**Issues:**

- No test ever changes `auth` to return `{ userId: null }` to test unauthenticated access
- The mock is copy-pasted into every test file instead of imported from `setup.ts`, creating maintenance burden
- `merge.test.ts` uses `userId: "user-owner"` while most others use `userId: "user-123"` -- inconsistent but not broken
- No test validates behavior when `currentUser` returns `null` (deleted Clerk account)

#### 4d. State Leakage Between Tests

| File                   | Risk                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `rate-limit.test.ts`   | Uses an incrementing `testCounter` + unique user IDs per test -- **good pattern**, no leakage |
| `birthday.test.ts`     | `beforeEach` at module level (not inside `describe`) -- works but is unconventional           |
| Action tests           | All use `vi.clearAllMocks()` in `beforeEach` -- **good**, no leakage detected                 |
| `relationship.test.ts` | Module-level `mockClient` is shared across describes, cleared in `beforeEach` -- safe         |

No state leakage issues detected. The test suite handles mock cleanup correctly.

---

### 5. Organization Issues

#### 5a. File Naming Convention

The codebase uses **`.test.ts`** consistently for unit/integration tests and **`.spec.ts`** for E2E tests (Playwright). This is a reasonable and consistent convention.

| Pattern                    | Count | Location                      |
| -------------------------- | ----- | ----------------------------- |
| `*.test.ts` / `*.test.tsx` | 32    | `src/` and `tests/` (non-E2E) |
| `*.spec.ts`                | 6     | `tests/e2e/` only             |

**No mixing of `.test.ts` and `.spec.ts` in the same directory.** Good.

#### 5b. Test File Location

Per CLAUDE.md, tests should be in `/tests`. However, many test files are co-located with source:

| Location                                 | Count | CLAUDE.md Compliant?                   |
| ---------------------------------------- | ----- | -------------------------------------- |
| `src/lib/validators/*.test.ts`           | 6     | NO -- should be in `tests/validators/` |
| `src/lib/utils/*.test.ts`                | 5     | NO -- should be in `tests/utils/`      |
| `src/lib/utils/__tests__/*.test.ts`      | 5     | NO -- should be in `tests/utils/`      |
| `src/lib/actions/__tests__/*.test.ts`    | 11    | NO -- should be in `tests/actions/`    |
| `src/lib/hooks/__tests__/*.test.ts`      | 1     | NO -- should be in `tests/hooks/`      |
| `src/components/**/__tests__/*.test.tsx` | 1     | NO -- should be in `tests/components/` |
| `tests/**/*.test.ts`                     | 11    | YES                                    |
| `tests/e2e/*.spec.ts`                    | 6     | YES                                    |

**28 of 39 test files violate the CLAUDE.md file organization rule.** The vitest config includes both `src/**/*.test.{ts,tsx}` and `tests/**/*.test.{ts,tsx}`, so tests run from both locations. However, CLAUDE.md says "Use `/tests` for test files."

#### 5c. Test Structure Consistency

All test files use the `describe` / `it` / `expect` pattern consistently. No inconsistencies found.

#### 5d. Duplicate Test Coverage

| Overlap          | Files                                                                                                          | Severity                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Sanitize tests   | `tests/security/sanitize.test.ts` AND `tests/security/sanitize-integration.test.ts`                            | LOW -- integration file tests cross-cutting concerns, not pure duplication                                                                 |
| Validator tests  | `src/lib/validators/validators.test.ts` AND individual `src/lib/validators/*.test.ts`                          | MEDIUM -- `validators.test.ts` re-tests the same schemas already tested in individual files. 4 duplicate test cases for `createTreeSchema` |
| Permission tests | `src/lib/actions/__tests__/permissions.test.ts` AND `src/lib/actions/__tests__/permission-integration.test.ts` | LOW -- integration file focuses on cross-action permission enforcement, minimal overlap                                                    |
| Tree stats       | `tests/tree/tree-stats.test.ts` AND `tests/tree/tree-stats-edge-cases.test.ts`                                 | LOW -- edge cases file extends coverage, not duplication                                                                                   |

---

### 6. Missing Test Categories

| Category                            | Status              | Details                                                                                                                                                                                       |
| ----------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Validator-to-action integration** | COVERED             | `tests/actions/validator-integration.test.ts` tests temporal, cycle, and duplicate validation through server actions                                                                          |
| **Error boundary components**       | MISSING             | No error boundary tests found. If the app has React error boundaries, they are untested                                                                                                       |
| **Auth flow (middleware)**          | MISSING             | No middleware.ts found in src/. No tests for route protection. Clerk integration is only tested via mocked `auth()` calls in action tests                                                     |
| **Real-time functionality**         | MISSING             | `use-realtime-tree.ts` hook exists but has zero tests. Supabase real-time subscriptions are completely untested                                                                               |
| **GEDCOM parser edge cases**        | PARTIALLY COVERED   | `gedcom-parser.test.ts` and `gedcom-extended-relationships.test.ts` exist. Missing: malformed GEDCOM files, files with encoding issues, extremely large files, files with circular references |
| **Accessibility**                   | EFFECTIVELY MISSING | The only a11y test is `expect(true).toBe(true)`. E2E a11y spec exists but likely gated behind env vars                                                                                        |
| **Component interaction tests**     | MISSING             | No tests for dialog open/close flows, form submission with validation errors, canvas drag interactions                                                                                        |
| **Performance/load tests**          | PARTIALLY COVERED   | `src/lib/utils/__tests__/performance.test.ts` exists. Missing: performance tests for large trees (1000+ nodes), GEDCOM import of large files                                                  |
| **Concurrent operation tests**      | MISSING             | No tests for race conditions (simultaneous edits, concurrent invite acceptance)                                                                                                               |

---

### 7. Test Infrastructure Issues

#### 7a. Vitest Configuration

The `vitest.config.ts` is minimal but functional:

```typescript
{
  environment: "jsdom",
  globals: true,
  setupFiles: ["./src/test-setup.ts"],
  include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.{ts,tsx}"],
}
```

**Issues:**

- **No coverage configuration.** There is no `coverage` block, meaning `vitest --coverage` uses defaults. Should configure `provider`, `include`/`exclude`, and threshold enforcement.
- **E2E specs are `.spec.ts` and are excluded** from vitest (correctly -- they use Playwright). But no Playwright config was audited.
- **No test timeout configured.** Default vitest timeout is 5000ms. Some integration tests with complex mock chains could benefit from explicit timeouts.
- **`globals: true`** means `describe`, `it`, `expect` are available without import. Yet every test file imports them explicitly from `vitest`. This is redundant but harmless.

#### 7b. Test Setup

`src/test-setup.ts` contains only:

```typescript
import "@testing-library/jest-dom/vitest";
```

This is correct for adding DOM matchers. However:

- The `setup.ts` in `src/lib/actions/__tests__/` is a separate, manual setup not connected to vitest's `setupFiles`
- Each action test file re-declares the same mocks (Clerk, server-only, next/cache, profile) instead of importing from `setup.ts`

#### 7c. DRYness of Test Utilities

**Duplicated patterns across action tests:**

1. **Clerk mock** -- Copy-pasted identically into 11 files. Should be a shared fixture.
2. **Supabase mock client creation** -- At least 4 different implementations:
   - `createMockSupabaseClient()` in `setup.ts` (used by 2 files)
   - `makeMockClient()` inline in `member.test.ts`
   - `makeMockClient()` inline in `permission-integration.test.ts`
   - `createChainableQuery()` in `validator-integration.test.ts`
   - Inline `{ from: vi.fn() }` in several others
3. **Membership mock helper** -- `mockMembership()` helper exists in `document.test.ts` but is re-implemented differently in other files.

**Recommendation:** Create a shared `tests/helpers/` directory with:

- `mock-clerk.ts` -- Shared Clerk mock with ability to override userId
- `mock-supabase.ts` -- Single, well-tested Supabase mock factory
- `mock-membership.ts` -- Reusable membership/role mock builders

---

### 8. Recommended Test Infrastructure Improvements

#### Immediate (blocks quality)

1. **Add vitest coverage configuration** with thresholds:

   ```typescript
   coverage: {
     provider: 'v8',
     include: ['src/lib/**/*.ts'],
     exclude: ['**/*.test.ts', '**/__tests__/**'],
     thresholds: { statements: 70, branches: 65, functions: 70, lines: 70 }
   }
   ```

2. **Delete or implement the placeholder a11y test** (`tests/a11y/components.test.tsx`). A test with `expect(true).toBe(true)` is worse than no test -- it creates false confidence.

3. **Implement the E2E test stubs** in `tests/e2e/tree-crud.spec.ts` or remove them. Empty test bodies that just navigate to `/dashboard` provide zero value.

4. **Add unauthenticated access tests.** No test currently validates what happens when `auth()` returns `{ userId: null }`. This is the most basic security test.

5. **Consolidate mock setup into shared helpers.** The Clerk mock is copy-pasted 11 times. Create `tests/helpers/mock-clerk.ts` and `tests/helpers/mock-supabase.ts`.

#### Short-term (next sprint)

6. **Add tests for `auth.ts`, `profile.ts`, `photo.ts`, and `import.ts`** server actions. These are high-risk untested files.

7. **Add component tests for dialog components** (`create-tree-dialog`, `add-member-dialog`, `edit-member-dialog`). These are user-facing forms where validation bugs directly affect users.

8. **Add `use-realtime-tree.ts` hook tests.** Real-time subscriptions are a common source of memory leaks and stale state.

9. **Move co-located test files to `tests/`** per CLAUDE.md convention, or explicitly update CLAUDE.md to allow co-location.

#### Medium-term (next quarter)

10. **Add component snapshot or interaction tests** for the 44 untested components, prioritizing `tree-canvas.tsx`, `member-node.tsx`, and dialog components.

11. **Add concurrent operation tests** for invite acceptance and simultaneous tree edits.

12. **Add GEDCOM parser fuzzing** with malformed inputs, encoding edge cases, and very large files.

13. **Add performance regression tests** for tree rendering with 500+ and 1000+ nodes.

---

### Summary Statistics

| Metric                                                                 | Value                                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Total test files                                                       | 39                                                                                   |
| Total source files (actions + components + validators + utils + hooks) | 77                                                                                   |
| Files with direct test coverage                                        | 25                                                                                   |
| Files with zero test coverage                                          | 52                                                                                   |
| Overall file-level coverage                                            | 32.5%                                                                                |
| Useless/placeholder tests                                              | 2 (a11y placeholder, E2E stubs)                                                      |
| Mock duplication instances                                             | 11 (Clerk mock copy-paste)                                                           |
| Test files violating CLAUDE.md location rules                          | 28 of 39                                                                             |
| Missing test categories                                                | 5 (error boundaries, middleware auth, real-time, component interaction, concurrency) |
