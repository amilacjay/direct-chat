import { test, expect } from '@playwright/test';
import { devLogin, makeUser } from './helpers';

test.describe('Friend requests', () => {
  test('one user sends a request, the other accepts it', async ({ browser }) => {
    const sender = makeUser('Sender');
    const receiver = makeUser('Receiver');

    const ctxS = await browser.newContext();
    const ctxR = await browser.newContext();
    const pageS = await ctxS.newPage();
    const pageR = await ctxR.newPage();

    await devLogin(pageS, sender);
    await devLogin(pageR, receiver);

    // Sender sees Receiver online, hovers and clicks Add Friend
    const receiverItem = pageS.getByTestId('user-item').filter({ hasText: receiver.name });
    await expect(receiverItem).toBeVisible({ timeout: 10000 });
    await receiverItem.hover();
    await receiverItem.getByTestId('add-friend-btn').click();

    // Receiver opens Friends -> Requests tab and accepts
    await pageR.getByTestId('profile-link').click();
    await pageR.getByRole('link', { name: 'Friends' }).click();
    await pageR.getByRole('button', { name: /Requests/ }).click();

    const requestItem = pageR.getByTestId('friend-request-item').filter({ hasText: sender.name });
    await expect(requestItem).toBeVisible({ timeout: 10000 });
    await requestItem.getByTestId('accept-friend').click();

    // After accepting, the request disappears and a success toast shows
    await expect(pageR.getByText(/accepted/i)).toBeVisible({ timeout: 10000 });

    // Friends tab now lists the sender (scope to main content, not the sidebar)
    await pageR.getByRole('button', { name: /Friends \(/ }).click();
    await expect(pageR.getByRole('main').getByText(sender.name)).toBeVisible({ timeout: 10000 });

    await ctxS.close();
    await ctxR.close();
  });
});
