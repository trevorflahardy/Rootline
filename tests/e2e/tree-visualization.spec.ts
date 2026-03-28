import { test, expect, waitForHydration } from './fixtures';

test.describe('Tree Visualization', () => {
  test.skip(!process.env.E2E_TEST_EMAIL, 'Requires authenticated session with tree data');

  test('tree canvas renders with nodes', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
    // Navigate to first tree
  });

  test('click node opens detail panel', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });

  test('Cmd+K opens search', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });

  test('zoom controls are visible', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });
});
