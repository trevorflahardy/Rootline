import { test, expect, waitForHydration } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

/**
 * Color-contrast violations are excluded because they are pre-existing
 * design-level issues tracked separately.  This suite focuses on
 * structural / semantic a11y (landmarks, labels, roles, focus order).
 */
const DISABLE_RULES = ['color-contrast'];

test.describe('Accessibility', () => {
  test('landing page has no critical a11y violations', async ({ page }) => {
    await page.goto('/');
    await waitForHydration(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(DISABLE_RULES)
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
    ).toEqual([]);
  });

  test('sign-in page has no critical a11y violations', async ({ page }) => {
    await page.goto('/sign-in');
    await waitForHydration(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(DISABLE_RULES)
      // Exclude Clerk's third-party iframe which we can't control
      .exclude('.cl-rootBox')
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
    ).toEqual([]);
  });

  test('sign-up page has no critical a11y violations', async ({ page }) => {
    await page.goto('/sign-up');
    await waitForHydration(page);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(DISABLE_RULES)
      .exclude('.cl-rootBox')
      .analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
    ).toEqual([]);
  });
});
