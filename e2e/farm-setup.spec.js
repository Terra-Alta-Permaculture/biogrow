import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Farm Setup', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('adds a zone', async ({ page }) => {
    // Navigate to farm/beds tab
    await page.getByRole('tab', { name: /farm|beds|zone/i }).click();
    await page.getByRole('button', { name: /add zone/i }).click();

    // Should see the new zone
    await expect(page.getByText(/zone/i).first()).toBeVisible();
  });

  test('adds a bed to a zone', async ({ page }) => {
    await page.getByRole('tab', { name: /farm|beds|zone/i }).click();
    await page.getByRole('button', { name: /add zone/i }).click();

    // Add bed within the zone
    await page.getByRole('button', { name: /add bed/i }).first().click();
    await expect(page.getByText(/bed/i).first()).toBeVisible();
  });
});
