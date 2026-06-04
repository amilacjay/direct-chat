import { test, expect } from "@playwright/test";

test.describe("Smoke — landing page", () => {
  test("page loads and guest button is visible", async ({ page }) => {
    await page.goto("/");

    // Page should load with a meaningful title or body content
    await expect(page).toHaveTitle(/.+/);

    // The landing page must expose a guest-entry button
    const guestBtn = page.getByTestId("guest-btn");
    await expect(guestBtn).toBeVisible();
  });
});
