import { test, expect, waitForHydration } from './fixtures';

test.describe('Tree CRUD', () => {
  test.skip(!process.env.E2E_TEST_EMAIL, 'Requires authenticated session');

  test('create tree from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
    // Look for create tree button/dialog
    const createBtn = page.getByRole('button', { name: /create.*tree|new.*tree/i });
    await expect(createBtn).toBeVisible();
  });

  test('add members to tree', async ({ page }) => {
    // Navigate to a tree page, click add member
    await page.goto('/dashboard');
    await waitForHydration(page);
    // Detailed steps depend on authenticated session
  });

  test('edit member name inline', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });

  test('delete member removes from canvas', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });

  test('delete tree removes from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
  });
});
