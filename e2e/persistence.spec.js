import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Data Persistence', () => {
  test('account persists after reload', async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);

    // Should be logged in
    await expect(page.getByRole('tablist')).toBeVisible();

    // Reload the page
    await page.reload();

    // Should still be logged in (not see auth screen)
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10000 });
  });

  test('farm data persists after reload', async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);

    // Add a zone
    await page.getByRole('tab', { name: /farm|beds|zone/i }).click();
    await page.getByRole('button', { name: /add zone/i }).click();

    // Reload
    await page.reload();
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    // Navigate back to farm tab — zone should still be there
    await page.getByRole('tab', { name: /farm|beds|zone/i }).click();
    await expect(page.getByText(/zone 1/i).first()).toBeVisible();
  });
});
