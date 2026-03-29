import { test as base, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

export const test = base.extend<Record<string, never>>({
  // Custom fixtures will go here
});

export { expect };

/** Helper to generate a unique email for test isolation */
export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.rootline.app`;
}

/** Helper to wait for Next.js hydration */
export async function waitForHydration(page: Page) {
  await page.waitForLoadState("networkidle");
}
