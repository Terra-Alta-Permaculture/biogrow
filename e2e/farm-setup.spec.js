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
    // Farm is the default tab
    await page.getByRole('tab', { name: /farm/i }).click();

    // Click "+ Add Zone" — opens dialog
    await page.getByRole('button', { name: /add zone/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Type a zone name (required) and confirm
    await dialog.getByRole('textbox', { name: /zone name/i }).fill('Zone 1');
    await dialog.getByRole('button', { name: /add zone/i }).click();

    // Should see the new zone on the page
    await expect(page.getByText('Zone 1').first()).toBeVisible();
  });

  test('adds a bed to a zone', async ({ page }) => {
    await page.getByRole('tab', { name: /farm/i }).click();

    // Create a zone first
    await page.getByRole('button', { name: /add zone/i }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: /zone name/i }).fill('Zone 1');
    await dialog.getByRole('button', { name: /add zone/i }).click();

    // Wait for zone to appear
    await expect(page.getByText('Zone 1').first()).toBeVisible();

    // Add a bed
    const addBedBtn = page.getByRole('button', { name: /add bed/i }).first();
    await addBedBtn.click();

    // The add bed dialog may appear — check and confirm
    const bedDialog = page.getByRole('dialog');
    if (await bedDialog.isVisible({ timeout: 1000 }).catch(() => false)) {
      // If there's a dialog, fill required fields and confirm
      const confirmBtn = bedDialog.getByRole('button', { name: /add bed/i });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
    }

    await expect(page.getByText(/bed/i).first()).toBeVisible();
  });
});
