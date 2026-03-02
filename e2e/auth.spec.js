import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, loginAs } from './helpers.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
  });

  test('shows auth screen on first visit', async ({ page }) => {
    await expect(page.getByText(/create account/i).first()).toBeVisible();
  });

  test('creates a new account', async ({ page }) => {
    const creds = await createTestAccount(page);
    // Should be in the main app with a tablist
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('logs out and back in', async ({ page }) => {
    const creds = await createTestAccount(page);

    // Find and click profile/logout
    await page.getByRole('button', { name: /profile/i }).click();
    await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();

    // Should see auth screen
    await expect(page.getByText(/sign in|log in/i).first()).toBeVisible();

    // Log back in
    await loginAs(page, creds.email, creds.password);
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.locator('input[type="password"]').first().fill('wrongpass');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await expect(page.getByText(/no account|incorrect|invalid/i).first()).toBeVisible();
  });
});
