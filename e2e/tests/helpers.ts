import { Page, expect, BrowserContext, Browser } from '@playwright/test';

export interface TestUser {
  email: string;
  name: string;
  dob: string; // YYYY-MM-DD
}

let counter = 0;
export function makeUser(name: string, dob = '1990-01-01'): TestUser {
  counter += 1;
  const unique = `${Date.now()}_${counter}`;
  return { email: `${name.toLowerCase()}_${unique}@example.com`, name: `${name}${counter}`, dob };
}

/** Log in a registered user via the dev-login form on the landing page. */
export async function devLogin(page: Page, user: TestUser): Promise<void> {
  await page.goto('/');
  await page.getByTestId('dev-login-email').fill(user.email);
  await page.getByTestId('dev-login-name').fill(user.name);
  await page.getByTestId('dev-login-dob').fill(user.dob);
  await page.getByTestId('dev-login-submit').click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

/** Continue as a guest from the landing page. */
export async function guestLogin(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('guest-btn').click();
  await expect(page).toHaveURL(/\/app/, { timeout: 10000 });
}

/** Open a fresh isolated browser context + page. */
export async function newUserPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  return { context, page };
}

/** From the app, click the online user whose name matches. */
export async function openChatWith(page: Page, displayName: string): Promise<void> {
  const item = page.getByTestId('user-item').filter({ hasText: displayName });
  await expect(item).toBeVisible({ timeout: 10000 });
  await item.click();
  await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 10000 });
}
