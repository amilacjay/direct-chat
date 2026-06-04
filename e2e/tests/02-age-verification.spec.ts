import { test, expect } from '@playwright/test';
import { makeUser } from './helpers';

test.describe('Age verification (18+)', () => {
  test('rejects an under-18 registration and stays on landing', async ({ page }) => {
    const minor = makeUser('Minor', '2015-01-01'); // ~11 years old
    await page.goto('/');
    await page.getByTestId('dev-login-email').fill(minor.email);
    await page.getByTestId('dev-login-name').fill(minor.name);
    await page.getByTestId('dev-login-dob').fill(minor.dob);
    await page.getByTestId('dev-login-submit').click();

    // Should NOT enter the app
    await expect(page).not.toHaveURL(/\/app/, { timeout: 5000 });
    await expect(page.getByText(/18 or older/i)).toBeVisible();
  });

  test('accepts an 18+ registration', async ({ page }) => {
    const adult = makeUser('Adult', '1990-06-15');
    await page.goto('/');
    await page.getByTestId('dev-login-email').fill(adult.email);
    await page.getByTestId('dev-login-name').fill(adult.name);
    await page.getByTestId('dev-login-dob').fill(adult.dob);
    await page.getByTestId('dev-login-submit').click();
    await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
  });
});
