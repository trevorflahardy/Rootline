import { test as base, expect } from '@playwright/test';

export const test = base.extend<{
  // Add custom fixtures here as needed
}>({
  // Custom fixtures will go here
});

export { expect };

/** Helper to generate a unique email for test isolation */
export function testEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@test.rootline.app`;
}

/** Helper to wait for Next.js hydration */
export async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle');
}
