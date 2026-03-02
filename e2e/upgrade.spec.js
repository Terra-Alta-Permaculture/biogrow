import { test, expect } from '@playwright/test';
import { clearStorage, createTestAccount, openToolsTab } from './helpers.js';

test.describe('Upgrade Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearStorage(page);
    await page.reload();
    await createTestAccount(page);
  });

  test('opens upgrade modal from profile tab', async ({ page }) => {
    await openToolsTab(page, 'profile');
    // Click the upgrade button in the subscription section
    const upgradeBtn = page.getByRole('button', { name: /upgrade now/i }).first();
    await upgradeBtn.click();
    // Upgrade modal should be visible with plan details
    await expect(page.getByText('Full Access Plan')).toBeVisible();
  });

  test('upgrade modal shows Stripe payment button', async ({ page }) => {
    await openToolsTab(page, 'profile');
    const upgradeBtn = page.getByRole('button', { name: /upgrade now/i }).first();
    await upgradeBtn.click();
    // Should show the card/stripe payment option
    await expect(page.getByText(/card.*stripe/i)).toBeVisible();
  });

  test('promo code validation works in upgrade modal', async ({ page }) => {
    await openToolsTab(page, 'profile');
    const upgradeBtn = page.getByRole('button', { name: /upgrade now/i }).first();
    await upgradeBtn.click();

    // Enter invalid promo code
    await page.getByPlaceholder('Enter code').fill('INVALID');
    await page.getByRole('button', { name: /apply/i }).click();
    await expect(page.getByText('Invalid promo code')).toBeVisible();

    // Enter valid promo code
    await page.getByPlaceholder('Enter code').fill('BIOGROW50');
    await page.getByRole('button', { name: /apply/i }).click();
    await expect(page.getByText(/50% Student Discount applied/)).toBeVisible();
  });

  test('trial expired shows lock screen', async ({ page }) => {
    // Expire the trial by manipulating localStorage
    await page.evaluate(() => {
      const authKey = 'biogrow-auth';
      const raw = localStorage.getItem(authKey);
      if (raw) {
        const user = JSON.parse(raw);
        user.subscription.trialEndDate = new Date(Date.now() - 86400000).toISOString();
        localStorage.setItem(authKey, JSON.stringify(user));
      }
    });
    await page.reload();
    await page.waitForTimeout(500);

    // Should see the lock screen
    await expect(page.getByText('Trial Expired')).toBeVisible();
    await expect(page.getByText('Upgrade Now').first()).toBeVisible();
  });
});
