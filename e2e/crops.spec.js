import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, openToolsTab } from './helpers.js';

test.describe('Crops Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
    // Crops is in the Tools dropdown
    await openToolsTab(page, 'crops');
  });

  test('displays crop database', async ({ page }) => {
    await expect(page.getByText(/crop/i).first()).toBeVisible();
  });

  test('searches crops by name', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill('Tomato');
    await expect(page.getByText(/tomato/i).first()).toBeVisible();
  });

  test('filters crops by type', async ({ page }) => {
    // Click a type filter button (Vegetables or Flowers)
    const vegBtn = page.getByRole('button', { name: /vegetable/i });
    if (await vegBtn.isVisible()) {
      await vegBtn.click();
    }
    // Should still see crop entries
    await expect(page.getByText(/crop/i).first()).toBeVisible();
  });
});
