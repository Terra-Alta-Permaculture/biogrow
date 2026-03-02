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
    // Dark mode is stored in 'biogrow-dark' localStorage key
    const initialDark = await page.evaluate(() => localStorage.getItem('biogrow-dark'));

    // Click dark mode toggle
    await page.getByRole('button', { name: /dark mode|light mode/i }).click();

    // Dark mode value should have changed
    const newDark = await page.evaluate(() => localStorage.getItem('biogrow-dark'));
    expect(newDark).not.toBe(initialDark);
  });

  test('dark mode persists on reload', async ({ page }) => {
    // Toggle dark mode on
    await page.getByRole('button', { name: /dark mode/i }).click();

    const darkVal = await page.evaluate(() => localStorage.getItem('biogrow-dark'));
    expect(darkVal).toBe('true');

    // Reload
    await page.reload();
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    const darkValAfter = await page.evaluate(() => localStorage.getItem('biogrow-dark'));
    expect(darkValAfter).toBe('true');
  });
});
