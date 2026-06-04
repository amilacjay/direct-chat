import { test, expect } from '@playwright/test';
import { devLogin, makeUser, openChatWith } from './helpers';

test.describe('Presence and P2P chat', () => {
  test('two users see each other online and can exchange messages', async ({ browser }) => {
    const alice = makeUser('Alice');
    const bob = makeUser('Bob');

    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    await devLogin(pageA, alice);
    await devLogin(pageB, bob);

    // Presence: Alice sees Bob and vice-versa
    await expect(pageA.getByTestId('user-item').filter({ hasText: bob.name }))
      .toBeVisible({ timeout: 10000 });
    await expect(pageB.getByTestId('user-item').filter({ hasText: alice.name }))
      .toBeVisible({ timeout: 10000 });

    // Both open the chat with each other (needed to receive in real time)
    await openChatWith(pageA, bob.name);
    await openChatWith(pageB, alice.name);

    // Give WebRTC/relay a moment to establish
    await pageA.waitForTimeout(1500);

    // Alice -> Bob
    const msgFromAlice = 'Hello Bob from Alice';
    await pageA.getByTestId('chat-input').fill(msgFromAlice);
    await pageA.getByTestId('chat-send').click();
    await expect(pageB.getByTestId('message').filter({ hasText: msgFromAlice }))
      .toBeVisible({ timeout: 10000 });

    // Bob -> Alice
    const msgFromBob = 'Hi Alice from Bob';
    await pageB.getByTestId('chat-input').fill(msgFromBob);
    await pageB.getByTestId('chat-send').click();
    await expect(pageA.getByTestId('message').filter({ hasText: msgFromBob }))
      .toBeVisible({ timeout: 10000 });

    await ctxA.close();
    await ctxB.close();
  });

  test('a user going offline disappears from the online list', async ({ browser }) => {
    const carol = makeUser('Carol');
    const dave = makeUser('Dave');

    const ctxC = await browser.newContext();
    const ctxD = await browser.newContext();
    const pageC = await ctxC.newPage();
    const pageD = await ctxD.newPage();

    await devLogin(pageC, carol);
    await devLogin(pageD, dave);

    await expect(pageC.getByTestId('user-item').filter({ hasText: dave.name }))
      .toBeVisible({ timeout: 10000 });

    // Dave closes his session
    await ctxD.close();

    // Carol should see Dave leave
    await expect(pageC.getByTestId('user-item').filter({ hasText: dave.name }))
      .toHaveCount(0, { timeout: 10000 });

    await ctxC.close();
  });
});
