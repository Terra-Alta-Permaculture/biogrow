import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    // Clear Supabase env vars so E2E tests run in local-only mode (localStorage auth)
    command: 'VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
