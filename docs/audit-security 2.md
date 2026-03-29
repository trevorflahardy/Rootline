# Security Audit Report

**Application**: Rootline Family Tree Tracker
**Date**: 2026-03-28
**Auditor**: Security Auditor Agent (V3)
**Scope**: All server actions (`src/lib/actions/`), API routes (`src/app/api/`), configuration, dependencies, and client-side code

---

## Summary

| Severity | Count |
| -------- | ----- |
| Critical | 1     |
| High     | 5     |
| Medium   | 8     |
| Low      | 5     |

Overall security posture: **Good with targeted gaps**. The codebase demonstrates strong security fundamentals -- consistent auth checks, Zod validation, UUID assertion, input sanitization, rate limiting, and proper webhook signature verification. The issues identified are specific gaps rather than systemic failures.

---

## Critical Vulnerabilities

### CRIT-01: `share.ts` functions use admin client without authentication

**File**: `src/lib/actions/share.ts`
**Lines**: 13-57

The three public share functions (`getPublicTree`, `getPublicMembers`, `getPublicRelationships`) do **not** have the `"use server"` directive and do **not** call `getAuthUser()`. While these are intentionally unauthenticated (they serve public tree data), they use `createAdminClient()` which bypasses Row-Level Security entirely.

**Risk**: If the `is_public` check were ever removed or bypassed (e.g., via a Supabase policy change or a code regression), the admin client would expose all tree data to unauthenticated users with no safety net.

**Impact**: Potential unauthorized data access to all family trees.

**Remediation**:

1. Add `"use server"` directive to `share.ts`.
2. Consider using a non-admin Supabase client for public queries (one that relies on RLS with a policy that only exposes `is_public = true` rows), so that the admin bypass is not the sole security gate.
3. Alternatively, add an explicit double-check: query `family_trees` for `is_public = true` in a single joined query rather than trusting a separate lookup.

---

## High Risk

### HIGH-01: Missing `assertUUID` on `treeId` in `document.ts` upload

**File**: `src/lib/actions/document.ts`
**Lines**: 24-28

The `uploadDocument` function extracts `treeId` and `memberId` from raw `FormData` via `formData.get("treeId") as string` and `formData.get("memberId") as string` without calling `assertUUID()` on either value. These values are used directly in database queries and storage path construction.

**Impact**: A malformed or malicious ID could bypass expected query behavior or cause unexpected storage paths.

**Remediation**: Add `assertUUID(treeId, 'treeId')` and `assertUUID(memberId, 'memberId')` after extracting from FormData.

### HIGH-02: Missing `assertUUID` on multiple action parameters

**Files & Functions**:

- `getTreeMemberships(treeId)` in `tree.ts:163` -- no `assertUUID` on `treeId`
- `updateMembership(membershipId, treeId, role)` in `tree.ts:195` -- no `assertUUID` on either ID
- `removeMembership(membershipId, treeId)` in `tree.ts:221` -- no `assertUUID` on either ID
- `getAuditLog(treeId)` in `audit.ts:76` -- no `assertUUID` on `treeId`
- `createSnapshot(treeId)` in `audit.ts:207` -- no `assertUUID` on `treeId`
- `getSnapshots(treeId)` in `audit.ts:253` -- no `assertUUID` on `treeId`
- `rollbackToSnapshot(treeId, snapshotId)` in `audit.ts:270` -- no `assertUUID` on either ID
- `getTreeHealth(treeId)` in `tree-health.ts:17` -- no `assertUUID` on `treeId`
- `getTreeStats(treeId)` in `tree-stats.ts:45` -- no `assertUUID` on `treeId`
- `deleteDocument(documentId, treeId)` in `document.ts:180` -- no `assertUUID` on either ID
- `updateDocument(documentId, treeId)` in `document.ts:225` -- no `assertUUID` on either ID
- `getDocumentDownloadUrl(documentId, treeId)` in `document.ts:276` -- no `assertUUID` on either ID
- `getDocumentsByMember(treeId, memberId)` in `document.ts:118` -- no `assertUUID` on either ID
- `getDocumentsByTree(treeId)` in `document.ts:153` -- no `assertUUID` on `treeId`
- `markAsRead(notificationId)` in `notification.ts:190` -- no `assertUUID` on `notificationId`

**Impact**: Non-UUID strings passed to Supabase `.eq()` filters could cause unexpected behavior or, in edge cases, information leakage via error messages.

**Remediation**: Add `assertUUID()` calls at the top of every function that accepts an ID parameter.

### HIGH-03: Vulnerable dependency `@clerk/backend` (GHSA-gjxx-92w9-8v8f)

**Package**: `@clerk/backend` (transitive via `@clerk/nextjs`)
**Severity**: High (CVSS 7.4)
**CVE**: SSRF in `clerkFrontendApiProxy` may leak secret keys to unintended host

**Impact**: If `clerkFrontendApiProxy` is enabled, an attacker could redirect requests and exfiltrate Clerk secret keys.

**Remediation**: Update `@clerk/nextjs` to a version that ships `@clerk/backend >=3.2.3`.

### HIGH-04: Vulnerable dependency `path-to-regexp` (GHSA-j3q9-mxjg-w52f)

**Package**: `path-to-regexp` (transitive)
**Severity**: High (CVSS 7.5)
**CVE**: ReDoS via sequential optional groups

**Impact**: Denial of service through crafted URL patterns.

**Remediation**: Update to `path-to-regexp >=8.4.0` (likely via updating `next`).

### HIGH-05: In-memory rate limiting does not survive restarts or scale across instances

**File**: `src/lib/rate-limit.ts`

The primary `rateLimit()` function (used by all server actions) uses an in-memory `Map`. The async Redis variant exists (`rateLimitAsync`) but is never called by any action.

**Impact**: In a multi-instance deployment (Vercel serverless, multiple containers), each instance has an independent rate limit counter. An attacker could bypass rate limits by hitting different instances. Rate limit state is also lost on every cold start.

**Remediation**: Migrate all `rateLimit()` calls to `rateLimitAsync()` to use the Redis-backed implementation in production, or implement a middleware-level rate limiter.

---

## Medium Risk

### MED-01: No rate limiting on 11 server action files

The following action files have **no rate limiting** on any of their exported functions:

| File              | Functions without rate limiting                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notification.ts` | `getNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`                                                                                                |
| `audit.ts`        | `getAuditLog`, `createSnapshot`, `getSnapshots`, `rollbackToSnapshot`                                                                                              |
| `tree-health.ts`  | `getTreeHealth`                                                                                                                                                    |
| `tree-stats.ts`   | `getTreeStats`                                                                                                                                                     |
| `timeline.ts`     | `getTimelineEvents`                                                                                                                                                |
| `birthday.ts`     | `getBirthdayReminders`                                                                                                                                             |
| `permissions.ts`  | All 14 exported functions (including write operations like `bulkUpdateRoles`, `bulkRevokeMemberships`, `revokeMembership`, `updateMemberRole`, `selfAssignToNode`) |
| `profile.ts`      | `getProfile`, `updateProfilePreferences`                                                                                                                           |
| `merge.ts`        | `getOwnedTreesForMerge`, `previewMerge`, `mergeTree`                                                                                                               |
| `share.ts`        | `getPublicTree`, `getPublicMembers`, `getPublicRelationships`                                                                                                      |

**Impact**: Write operations (`createSnapshot`, `rollbackToSnapshot`, `mergeTree`, `bulkUpdateRoles`, `bulkRevokeMemberships`, `selfAssignToNode`) without rate limiting allow abuse -- especially `mergeTree` which deletes the source tree. The unauthenticated `share.ts` functions are particularly vulnerable to enumeration.

**Remediation**: Add rate limiting to all write operations. Add aggressive rate limiting to unauthenticated share endpoints.

### MED-02: Excessive data exposure via `select("*")` in 27 queries

**Files**: `tree.ts`, `member.ts`, `relationship.ts`, `document.ts`, `photo.ts`, `invite.ts`, `notification.ts`, `profile.ts`, `audit.ts`, `merge.ts`, `share.ts`

27 queries use `select("*")` which returns all columns from the database table, including potentially sensitive metadata (e.g., `created_by`, internal timestamps, storage paths). While these are server actions (data is not directly serialized to the client unless explicitly returned), the returned objects often flow to React components.

**Key concerns**:

- `getTreeMemberships` returns `profiles(display_name, email, avatar_url)` -- emails are exposed to all tree members, not just owners.
- `getTreeMembershipsWithActivity` also returns emails to any member.
- Document queries return `storage_path` which reveals internal Supabase bucket structure.
- `getInviteByCode` returns the full invite object including `invite_code` to any authenticated user.

**Remediation**: Replace `select("*")` with explicit column lists. Restrict email visibility to tree owners. Strip `storage_path` from document responses.

### MED-03: No Content-Security-Policy header

**File**: `next.config.ts`

The security headers configuration is comprehensive (X-Frame-Options, HSTS, X-Content-Type-Options, etc.) but is missing `Content-Security-Policy` (CSP).

**Impact**: No protection against XSS via inline scripts, unauthorized script sources, or data exfiltration via image/fetch directives.

**Remediation**: Add a CSP header. Start with a report-only policy to avoid breaking functionality:

```
Content-Security-Policy-Report-Only: default-src 'self'; script-src 'self' 'unsafe-inline' https://*.clerk.com; style-src 'self' 'unsafe-inline'; img-src 'self' https://*.supabase.co https://img.clerk.com data:; connect-src 'self' https://*.supabase.co https://*.clerk.com;
```

### MED-04: `rollbackToSnapshot` re-inserts raw snapshot data without sanitization

**File**: `src/lib/actions/audit.ts`
**Lines**: 319-339

The `rollbackToSnapshot` function reads `snapshot_data` from the database and re-inserts its `members` and `relationships` arrays directly via `.insert(snapshotData.members)` without any validation or sanitization. If snapshot data was ever tampered with (e.g., via direct DB access or a future API), the restored data would bypass all Zod validation.

**Impact**: Integrity bypass -- malformed or malicious data could be injected into the tree.

**Remediation**: Validate each member and relationship through the existing Zod schemas before re-insertion, or at minimum sanitize text fields.

### MED-05: `acceptInvite` race condition on `use_count` increment

**File**: `src/lib/actions/invite.ts`
**Lines**: 131-189

The invite acceptance flow reads `use_count`, checks against `max_uses`, then increments. This is a classic TOCTOU (time-of-check-to-time-of-use) race condition. Two simultaneous requests could both read `use_count = 0`, both pass the check, and both increment -- resulting in `max_uses` being exceeded.

**Impact**: An invite with `max_uses: 1` could be used multiple times.

**Remediation**: Use a Supabase RPC function with an atomic increment-and-check, or use `UPDATE ... SET use_count = use_count + 1 WHERE use_count < max_uses` and check affected rows.

### MED-06: No `.env.example` file

No `.env.example` file exists to document required environment variables.

**Impact**: Developers may misconfigure deployments. Required secrets (`CLERK_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`) are not documented.

**Remediation**: Create `.env.example` with all required variables (values redacted).

### MED-07: `saveMemberPositions` accepts unbounded array without validation

**File**: `src/lib/actions/member.ts`
**Lines**: 168-198

The `positions` parameter is an array of `{ id, position_x, position_y }` with no Zod validation, no length limit, and no UUID validation on the `id` field. Each position triggers a separate database query.

**Impact**: An attacker could send thousands of position updates in a single call, causing database load. The `id` values are not UUID-validated.

**Remediation**: Add Zod schema validation, cap array length (e.g., 500), and validate each `id` as UUID.

### MED-08: Audit log description not sanitized in `createSnapshot`

**File**: `src/lib/actions/audit.ts`
**Line**: 242

The `description` parameter is only `.trim()`-ed before insertion. It is not passed through `sanitizeText()` or validated via Zod schema.

**Impact**: HTML/script content could be stored in the description field and potentially rendered unsafely in the UI.

**Remediation**: Apply `sanitizeText()` to the description and add Zod validation with a max length.

---

## Low Risk

### LOW-01: `picomatch` ReDoS vulnerability (GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj)

**Package**: `picomatch` (transitive via `vitest`, `agentic-flow`)
**Severity**: Moderate-High (dev dependency)

**Impact**: Only affects build/test tooling, not production runtime. Low risk.

**Remediation**: Update `vitest` and check if `agentic-flow` has an updated version.

### LOW-02: `brace-expansion` DoS vulnerability (GHSA-f886-m6hf-6m8v)

**Package**: `brace-expansion` (transitive via `eslint`)
**Severity**: Moderate (dev dependency)

**Impact**: Only affects linting tooling. Low risk.

**Remediation**: Update `eslint` and related packages.

### LOW-03: Error messages may leak internal details

Throughout the codebase, Supabase error messages are propagated to the client:

```typescript
throw new Error(`Failed to create tree: ${treeError.message}`);
```

**Impact**: Database error messages could reveal table names, constraint names, or query structure.

**Remediation**: Log the full error server-side and return generic messages to the client. Use a pattern like:

```typescript
console.error("Failed to create tree:", treeError);
throw new Error("Failed to create tree. Please try again.");
```

### LOW-04: `getNotifications` limit parameter not validated

**File**: `src/lib/actions/notification.ts`
**Line**: 48

The `limit` parameter defaults to `20` but has no maximum cap. A caller could pass `limit = 100000`.

**Impact**: Large result sets could cause performance issues.

**Remediation**: Add `Math.min(limit, 100)` or similar cap.

### LOW-05: Browser Supabase client uses publishable key (acceptable but note)

**File**: `src/lib/supabase/client.ts`

The browser client uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`. This is correct -- the publishable/anon key is designed for client-side use. However, ensure RLS policies are correctly configured on all tables so that the anon key cannot access data without proper authentication context.

**Impact**: None if RLS is properly configured. Risk if RLS policies are misconfigured.

---

## Positive Findings (Things Done Well)

### AUTH-PASS: Consistent authentication pattern

Every server action file (except intentionally public `share.ts`) calls `getAuthUser()` at the top of every exported function. This is an excellent pattern that prevents auth bypass.

### AUTH-PASS: Clerk webhook signature verification

`src/app/api/webhooks/clerk/route.ts` properly validates `svix-signature`, `svix-id`, and `svix-timestamp` headers using the `svix` library before processing any webhook data. Missing headers return 400. Invalid signatures return 400. Missing webhook secret returns 500. This is textbook correct.

### AUTHZ-PASS: Tree membership checks on all data access

Every server action that accesses tree data verifies the requesting user's membership in `tree_memberships` before proceeding. Role-based checks (owner, editor, viewer) are consistently applied.

### AUTHZ-PASS: Scoped editor branch enforcement

Editor users with a `linked_node_id` are correctly restricted to their branch via the `is_descendant_of` RPC function. This is enforced in `member.ts`, `relationship.ts`, `document.ts`, and `photo.ts`.

### INPUT-PASS: Zod validation on all mutation inputs

All creation and update operations validate input through Zod schemas (`createTreeSchema`, `createMemberSchema`, `createRelationshipSchema`, `uploadDocumentSchema`, `createInviteSchema`, etc.) with appropriate field constraints (max lengths, enums, required fields).

### INPUT-PASS: UUID validation with `assertUUID`

Most functions receiving ID parameters validate them as UUIDs via `assertUUID()` before database queries. This prevents SQL injection via malformed IDs.

### INPUT-PASS: Text sanitization

User-supplied text fields (bio, birth_place, death_place, descriptions, file names) are consistently passed through `sanitizeText()` which strips HTML tags and script content. Storage paths are sanitized via `sanitizeStoragePath()` which blocks path traversal (`..`, `//`, leading `/`).

### INPUT-PASS: LLM prompt injection protection

`sanitizeForLLM()` exists in `src/lib/sanitize.ts` and strips control characters, prompt delimiters (`[INST]`, `<|im_start|>`), and role-injection patterns. This proactively protects against AI feature additions.

### UPLOAD-PASS: File upload security

Both `uploadPhoto` and `uploadDocument` enforce:

- File size limits (5MB photos, 25MB documents)
- MIME type allowlists
- Sanitized storage paths with UUID prefixes
- `upsert: false` to prevent overwrites

### HEADERS-PASS: Strong security headers

`next.config.ts` includes: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` with 1-year max-age, `Referrer-Policy`, `Permissions-Policy` (camera, mic, geo, payment, USB disabled), `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.

### SECRETS-PASS: No hardcoded secrets

No API keys, tokens, or credentials were found hardcoded in any source file. All secrets are accessed via `process.env`. The `.gitignore` correctly excludes all `.env*` files.

### SECRETS-PASS: `NEXT_PUBLIC_` prefix used correctly

Only the Supabase URL (`NEXT_PUBLIC_SUPABASE_URL`), publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`), and site URL (`NEXT_PUBLIC_SITE_URL`) are exposed to the client. No secret keys use the `NEXT_PUBLIC_` prefix.

### DESIGN-PASS: Admin client properly guarded

`src/lib/supabase/admin.ts` uses `import "server-only"` to prevent accidental import in client-side code.

### DESIGN-PASS: Temporal and graph validation

Relationship creation includes cycle detection (`detectCycle`), duplicate detection (`detectDuplicateRelationship`), parent-child date validation, and marriage date validation.

### DESIGN-PASS: Delete operations have dual ownership checks

`deleteTree` checks both `tree_memberships.role = 'owner'` AND `family_trees.owner_id = userId` before deletion, preventing privilege escalation.

---

## Recommendations

### Priority 1 (Do Now)

1. **Add `"use server"` to `share.ts`** and consider using a non-admin client for public queries.
2. **Add `assertUUID()` to all functions listed in HIGH-02**. This is a mechanical fix across ~15 call sites.
3. **Update `@clerk/nextjs`** to resolve the `@clerk/backend` SSRF vulnerability.
4. **Add rate limiting to write operations** in `permissions.ts`, `audit.ts`, and `merge.ts` -- especially `mergeTree`, `rollbackToSnapshot`, `bulkUpdateRoles`, and `bulkRevokeMemberships`.

### Priority 2 (Next Sprint)

5. **Migrate rate limiting to Redis** by switching `rateLimit()` calls to `rateLimitAsync()`.
6. **Fix the invite `use_count` race condition** with an atomic database operation.
7. **Add Content-Security-Policy** header (start with report-only mode).
8. **Create `.env.example`** documenting all required environment variables.
9. **Validate `saveMemberPositions`** input with Zod schema and length cap.
10. **Sanitize `createSnapshot` description** via `sanitizeText()`.

### Priority 3 (Backlog)

11. **Replace `select("*")` with explicit column lists** across all 27 query sites.
12. **Restrict email visibility** in `getTreeMemberships` and `getTreeMembershipsWithActivity` to owners only.
13. **Genericize error messages** to prevent internal detail leakage.
14. **Cap `getNotifications` limit** parameter.
15. **Update dev dependencies** (`picomatch`, `brace-expansion`) to resolve moderate vulnerabilities.
16. **Add rate limiting to public share endpoints** to prevent tree enumeration.
17. **Validate snapshot data** through Zod schemas before re-insertion in `rollbackToSnapshot`.

---

## Rate Limiting Coverage Matrix

| Action File       | Has Rate Limiting | Functions Missing RL                                                                                       |
| ----------------- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `tree.ts`         | Yes               | `getTreesForUser`, `getTreeById`, `getTreeMemberships`, `updateMembership`, `removeMembership`             |
| `member.ts`       | Yes               | `getMembersByTreeId`, `saveMemberPositions`, `getMembersWithStats`, `getMemberById`                        |
| `relationship.ts` | Yes               | `getRelationshipsByTreeId`                                                                                 |
| `document.ts`     | Yes (upload only) | `getDocumentsByMember`, `getDocumentsByTree`, `deleteDocument`, `updateDocument`, `getDocumentDownloadUrl` |
| `photo.ts`        | Yes (upload only) | `getPhotosByTreeId`, `getPhotosByMemberId`, `deletePhoto`                                                  |
| `invite.ts`       | Yes               | `getInvitesByTreeId`, `getInviteByCode`                                                                    |
| `import.ts`       | Yes               | --                                                                                                         |
| `permissions.ts`  | **No**            | All 14 functions                                                                                           |
| `notification.ts` | **No**            | All 4 functions                                                                                            |
| `audit.ts`        | **No**            | All 4 functions                                                                                            |
| `merge.ts`        | **No**            | All 3 functions                                                                                            |
| `tree-health.ts`  | **No**            | `getTreeHealth`                                                                                            |
| `tree-stats.ts`   | **No**            | `getTreeStats`                                                                                             |
| `timeline.ts`     | **No**            | `getTimelineEvents`                                                                                        |
| `birthday.ts`     | **No**            | `getBirthdayReminders`                                                                                     |
| `profile.ts`      | **No**            | `getProfile`, `updateProfilePreferences`                                                                   |
| `share.ts`        | **No**            | All 3 functions (unauthenticated)                                                                          |

---

## Dependency Vulnerability Summary

| Package           | Severity      | CVE/Advisory                             | Direct?          | Fix Available |
| ----------------- | ------------- | ---------------------------------------- | ---------------- | ------------- |
| `@clerk/backend`  | High          | GHSA-gjxx-92w9-8v8f (SSRF)               | Transitive       | Yes           |
| `path-to-regexp`  | High          | GHSA-j3q9-mxjg-w52f (ReDoS)              | Transitive       | Yes           |
| `picomatch`       | High/Moderate | GHSA-c2c7-rcm5-vvqj, GHSA-3v7f-55p6-f55p | Transitive (dev) | Yes           |
| `brace-expansion` | Moderate      | GHSA-f886-m6hf-6m8v (DoS)                | Transitive (dev) | Yes           |

**Total**: 7 vulnerabilities (3 high, 4 moderate). All have fixes available.
