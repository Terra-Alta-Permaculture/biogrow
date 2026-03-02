import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Responsive Layout', () => {
  test('mobile viewport shows the app correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);

    // App should render and be usable at mobile width
    await expect(page.getByRole('tablist').or(page.getByRole('navigation'))).toBeVisible();
  });

  test('tablet viewport shows the app correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);

    await expect(page.getByRole('tablist').or(page.getByRole('navigation'))).toBeVisible();
  });
});
