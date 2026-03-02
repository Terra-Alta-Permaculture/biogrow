import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Crops Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
    await page.getByRole('tab', { name: /crops/i }).click();
  });

  test('displays crop database', async ({ page }) => {
    await expect(page.getByText(/crop database/i).first()).toBeVisible();
  });

  test('searches crops by name', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Tomato');
    await expect(page.getByText(/tomato/i).first()).toBeVisible();
  });

  test('filters crops by type', async ({ page }) => {
    // Click a type filter button (Vegetables or Flowers)
    await page.getByRole('button', { name: /vegetable/i }).click();
    // Should still see crop entries
    await expect(page.getByText(/crop database/i).first()).toBeVisible();
  });
});
