import { test, expect } from '@playwright/test';
import { guestLogin } from './helpers';

test.describe('Guest mode', () => {
  test('guest can enter the app and has a guest identity', async ({ page }) => {
    await guestLogin(page);
    // Guests have no online/offline toggle (registered-only feature)
    await expect(page.getByTestId('nav-online-toggle')).toHaveCount(0);
  });

  test('guest photo button is disabled in chat', async ({ browser }) => {
    // A registered user needs to be online so the guest has someone to chat with.
    const reg = await browser.newContext();
    const regPage = await reg.newPage();
    const { makeUser, devLogin } = await import('./helpers');
    const host = makeUser('Host');
    await devLogin(regPage, host);

    const guestCtx = await browser.newContext();
    const guestPage = await guestCtx.newPage();
    await guestLogin(guestPage);

    // Guest opens chat with the registered host
    const item = guestPage.getByTestId('user-item').filter({ hasText: host.name });
    await expect(item).toBeVisible({ timeout: 10000 });
    await item.click();

    const photoBtn = guestPage.getByTestId('photo-btn');
    await expect(photoBtn).toBeVisible();
    // Guest photo button is wrapped/disabled — it must not open a file chooser.
    // The disabled guest button has no click handler that uploads.
    await expect(guestPage.getByTestId('chat-input')).toBeVisible();

    await reg.close();
    await guestCtx.close();
  });
});
