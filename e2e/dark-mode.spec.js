import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount } from './helpers.js';

test.describe('Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('toggles dark mode', async ({ page }) => {
    // Get initial background
    const initialBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Click dark mode toggle
    await page.getByRole('button', { name: /dark mode|light mode/i }).click();

    // Background should change
    const newBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(newBg).not.toBe(initialBg);
  });

  test('dark mode persists on reload', async ({ page }) => {
    // Toggle dark mode on
    await page.getByRole('button', { name: /dark mode/i }).click();
    const darkBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Reload
    await page.reload();
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    const bgAfterReload = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgAfterReload).toBe(darkBg);
  });
});
