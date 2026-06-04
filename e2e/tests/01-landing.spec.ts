import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows Google, Guest, and Dev login options', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('google-btn')).toBeVisible();
    await expect(page.getByTestId('guest-btn')).toBeVisible();
    // Dev login form (enabled in dev/E2E)
    await expect(page.getByTestId('dev-login-email')).toBeVisible();
    await expect(page.getByText(/18 or older/i)).toBeVisible();
  });
});
