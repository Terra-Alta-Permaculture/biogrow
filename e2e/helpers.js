/**
 * E2E test helpers for BioGrow.
 * All auth is localStorage-based in tests (no Supabase env vars set).
 */

export async function clearStorage(page) {
  await page.evaluate(() => localStorage.clear());
}

export async function createTestAccount(page) {
  const email = `test-${Date.now()}@example.com`;
  const password = 'test1234';
  const name = 'Test Farmer';
  const farmName = 'Test Farm';

  // Fill the sign-up form
  await page.getByRole('tab', { name: /create account/i }).click();
  await page.getByLabel(/full name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/farm name/i).fill(farmName);
  // Password fields — there may be two (password + confirm)
  const pwFields = page.locator('input[type="password"]');
  await pwFields.first().fill(password);
  if (await pwFields.count() > 1) {
    await pwFields.nth(1).fill(password);
  }
  await page.getByRole('button', { name: /create account/i }).click();

  // Wait for app to load (auth screen should disappear)
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  return { email, password, name, farmName };
}

export async function loginAs(page, email, password) {
  await page.getByLabel(/email/i).fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
}
