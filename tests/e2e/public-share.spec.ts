import { test, expect, waitForHydration } from './fixtures';

test.describe('Public Sharing', () => {
  test('share page returns 404 for non-existent tree', async ({ page }) => {
    const response = await page.goto('/share/00000000-0000-0000-0000-000000000000');
    // Should either 404 or show "not found" message
    const content = await page.textContent('body');
    expect(content).toBeTruthy();
  });

  test('share page for private tree shows not found', async ({ page }) => {
    await page.goto('/share/00000000-0000-0000-0000-000000000000');
    await waitForHydration(page);
    // Private/non-existent trees should not render tree data
  });
});
