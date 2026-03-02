import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, openToolsTab } from './helpers.js';

test.describe('Nursery Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('opens nursery tab and shows heading', async ({ page }) => {
    await page.getByRole('tab', { name: /nursery/i }).click();
    await expect(page.getByText('Nursery & Orders')).toBeVisible();
  });

  test('shows section navigation buttons', async ({ page }) => {
    await page.getByRole('tab', { name: /nursery/i }).click();
    await expect(page.getByRole('button', { name: /propagation settings/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sowing calendar/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /order lists/i })).toBeVisible();
  });

  test('shows sowing calendar section', async ({ page }) => {
    await page.getByRole('tab', { name: /nursery/i }).click();
    await page.getByText('Sowing Calendar').click();
    await expect(page.getByText(/sowing calendar/i)).toBeVisible();
  });
});
