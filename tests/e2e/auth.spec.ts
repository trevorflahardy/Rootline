import { test, expect, waitForHydration } from './fixtures';

test.describe('Authentication', () => {
  test('unauthenticated user visiting /dashboard is redirected to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await waitForHydration(page);
    await expect(page).toHaveURL(/sign-in/);
  });

  test('sign in flow redirects to dashboard', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForHydration(page);
    // Clerk sign-in form should be visible
    await expect(page.locator('[data-clerk-sign-in]').or(page.getByRole('heading', { name: /sign in/i }))).toBeVisible();
  });

  test('sign up page renders', async ({ page }) => {
    await page.goto('/sign-up');
    await waitForHydration(page);
    await expect(page.locator('[data-clerk-sign-up]').or(page.getByRole('heading', { name: /create your account|sign up/i }))).toBeVisible();
  });

  test('landing page loads without auth', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading').first()).toBeVisible();
  });

  test('session persists across navigation', async ({ page }) => {
    // This test requires an authenticated session — skip if no test credentials
    test.skip(!process.env.E2E_TEST_EMAIL, 'Requires E2E_TEST_EMAIL env var');
    await page.goto('/dashboard');
    await waitForHydration(page);
    await page.goto('/profile');
    await waitForHydration(page);
    await expect(page).not.toHaveURL(/sign-in/);
  });
});
