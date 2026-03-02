import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('switches between tabs', async ({ page }) => {
    const tablist = page.getByRole('tablist');
    await expect(tablist).toBeVisible();

    // Click Crops tab
    await page.getByRole('tab', { name: /crops/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    // Click Harvest tab
    await page.getByRole('tab', { name: /harvest/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('URL stays the same when switching tabs (SPA)', async ({ page }) => {
    const initialUrl = page.url();
    await page.getByRole('tab', { name: /crops/i }).click();
    expect(page.url()).toBe(initialUrl);
  });

  test('skip-to-content link exists', async ({ page }) => {
    const skipLink = page.getByText(/skip to/i);
    await expect(skipLink).toBeAttached();
  });
});
