import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Harvest Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
    await page.getByRole('tab', { name: /harvest/i }).click();
  });

  test('shows harvest log heading', async ({ page }) => {
    await expect(page.getByText(/harvest/i).first()).toBeVisible();
  });

  test('shows empty state when no harvests', async ({ page }) => {
    await expect(page.getByText(/no harvest|start logging|record your/i).first()).toBeVisible();
  });

  test('opens log harvest modal', async ({ page }) => {
    await page.getByRole('button', { name: /log harvest|add harvest/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
