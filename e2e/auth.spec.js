import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, loginAs, openToolsTab } from './helpers.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
  });

  test('shows auth screen on first visit', async ({ page }) => {
    await expect(page.getByText(/sign in/i).first()).toBeVisible();
  });

  test('creates a new account', async ({ page }) => {
    const creds = await createTestAccount(page);
    // Should be in the main app with a tablist
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('logs out and back in', async ({ page }) => {
    const creds = await createTestAccount(page);

    // Open profile from Tools menu and click logout
    await openToolsTab(page, 'profile');
    await page.getByRole('button', { name: /log ?out|sign ?out/i }).click();

    // Should see auth screen
    await expect(page.getByText(/sign in/i).first()).toBeVisible();

    // Log back in
    await loginAs(page, creds.email, creds.password);
    await expect(page.getByRole('tablist')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('farmer@example.com').fill('nobody@example.com');
    await page.getByPlaceholder('Your password').fill('wrongpass');
    await page.locator('button[type="submit"]').click();

    await expect(page.getByText(/no account|incorrect|invalid/i).first()).toBeVisible();
  });
});
