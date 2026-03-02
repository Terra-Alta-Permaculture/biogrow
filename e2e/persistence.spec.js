import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, dismissGuideModal } from './helpers.js';

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

    // Add a zone via dialog
    await page.getByRole('tab', { name: /farm/i }).click();
    await page.getByRole('button', { name: /add zone/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /zone name/i }).fill('Zone 1');
    await dialog.getByRole('button', { name: /add zone/i }).click();
    await expect(page.getByText('Zone 1').first()).toBeVisible();

    // Wait for localStorage save to complete (save indicator should show "Saved")
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Reload
    await page.reload();
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
    await dismissGuideModal(page);

    // Navigate back to farm tab — zone should still be there
    await page.getByRole('tab', { name: /farm/i }).click();
    await expect(page.getByText(/zone 1/i).first()).toBeVisible();
  });
});
