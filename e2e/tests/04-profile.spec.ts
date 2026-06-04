import { test, expect } from '@playwright/test';
import { devLogin, makeUser } from './helpers';

test.describe('Profile management', () => {
  test('registered user can edit and save profile, changes persist', async ({ page }) => {
    const user = makeUser('Profiler');
    await devLogin(page, user);

    // Open profile via the profile menu
    await page.getByTestId('profile-link').click();
    await page.getByRole('link', { name: 'Profile' }).click();

    await expect(page.getByTestId('display-name-input')).toBeVisible();

    const newName = `${user.name}_edited`.slice(0, 30);
    await page.getByTestId('display-name-input').fill(newName);
    await page.getByTestId('bio-input').fill('Hello, this is my bio.');
    await page.getByTestId('save-profile').click();

    // Toast confirms save
    await expect(page.getByText(/Profile saved/i)).toBeVisible({ timeout: 10000 });

    // Reload — the change should persist (fetched from server)
    await page.reload();
    await page.getByTestId('profile-link').click();
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByTestId('bio-input')).toHaveValue('Hello, this is my bio.');
  });
});
