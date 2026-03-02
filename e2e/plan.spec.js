import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Plan Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('opens plan tab and shows heading', async ({ page }) => {
    await page.getByRole('tab', { name: /plan/i }).click();
    await expect(page.getByText('Season Plan')).toBeVisible();
  });

  test('shows planning and schedule sub-tabs', async ({ page }) => {
    await page.getByRole('tab', { name: /plan/i }).click();
    await expect(page.getByRole('button', { name: /planning/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /schedule/i })).toBeVisible();
  });
});
