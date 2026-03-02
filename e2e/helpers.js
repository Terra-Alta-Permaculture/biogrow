/**
 * E2E test helpers for BioGrow.
 * All auth is localStorage-based in tests (no Supabase env vars set).
 *
 * Note: AuthScreen uses <label> + <input> without htmlFor/id binding,
 * so we use getByPlaceholder() instead of getByLabel().
 */

export async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

export async function createTestAccount(page) {
  const email = `test-${Date.now()}@example.com`;
  const password = 'test1234';
  const name = 'Test Farmer';
  const farmName = 'Test Farm';

  // Switch to Create Account mode (toggle button in the auth form header)
  await page.getByRole('button', { name: /create account/i }).click();

  // Fill the sign-up form using placeholder text
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('farmer@example.com').fill(email);
  await page.getByPlaceholder('Quinta da Horta').fill(farmName);
  await page.getByPlaceholder('At least 6 characters').fill(password);
  await page.getByPlaceholder('Repeat password').fill(password);

  // Submit — the submit button also says "Create Account"
  await page.locator('button[type="submit"]').click();

  // Wait for app to load (auth screen should disappear)
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  // Dismiss the WorkflowGuide modal if it appears (it blocks pointer events on the page)
  await dismissGuideModal(page);

  return { email, password, name, farmName };
}

export async function loginAs(page, email, password) {
  // Make sure we're on the Sign In mode
  const signInToggle = page.getByRole('button', { name: /^sign in$/i });
  if (await signInToggle.count() > 0) {
    await signInToggle.first().click();
  }
  await page.getByPlaceholder('farmer@example.com').fill(email);
  await page.getByPlaceholder('Your password').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  // Dismiss the WorkflowGuide modal if it reappears
  await dismissGuideModal(page);
}

/**
 * Dismiss the "Welcome to BioGrow" WorkflowGuide modal if visible.
 */
export async function dismissGuideModal(page) {
  const closeBtn = page.getByRole('button', { name: '✕' });
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
    // Wait for modal to disappear
    await page.waitForTimeout(300);
  }
}

/**
 * Open a tools menu item (Crops, Tasks, Profile, etc.) from the ⚙️ Tools dropdown.
 * Note: Tools button has role="button", not role="tab".
 */
export async function openToolsTab(page, tabName) {
  // Click the Tools dropdown button
  await page.getByRole('button', { name: /tools/i }).click();
  // Click the menu item
  await page.getByRole('menuitem', { name: new RegExp(tabName, 'i') }).click();
}
