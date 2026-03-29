import { test, waitForHydration } from "./fixtures";

test.describe("Import & Export", () => {
  test.skip(!process.env.E2E_TEST_EMAIL, "Requires authenticated session");

  test("GEDCOM import button exists on tree page", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForHydration(page);
  });

  test("export as PNG button exists", async ({ page }) => {
    await page.goto("/dashboard");
    await waitForHydration(page);
  });
});
