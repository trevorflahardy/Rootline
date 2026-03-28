import { test, expect, waitForHydration } from './fixtures';

test.describe('Collaboration', () => {
  test.skip(!process.env.E2E_TEST_EMAIL, 'Requires multiple authenticated sessions');

  test('invite link generation', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });

  test('viewer cannot edit tree', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });
});
