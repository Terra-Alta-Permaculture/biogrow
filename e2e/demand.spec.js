import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Demand Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('opens demand tab and shows heading', async ({ page }) => {
    await page.getByRole('tab', { name: /demand/i }).click();
    await expect(page.getByRole('heading', { name: /events/i })).toBeVisible();
  });

  test('shows create event button', async ({ page }) => {
    await page.getByRole('tab', { name: /demand/i }).click();
    await expect(page.getByRole('button', { name: /create event/i })).toBeVisible();
  });

  test('shows empty demand guidance text', async ({ page }) => {
    await page.getByRole('tab', { name: /demand/i }).click();
    // Empty state shows guidance about creating events
    await expect(page.getByText(/no events yet/i)).toBeVisible();
  });
});
