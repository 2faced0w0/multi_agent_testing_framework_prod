import { defineConfig, devices } from '@playwright/test';

/**
 * Central Playwright configuration for generated and curated E2E tests.
 * We isolate generated tests inside `playwright-generated/` to:
 *  - Keep them out of Jest's scope
 *  - Allow targeted post-processing / normalization
 */
export default defineConfig({
  testDir: 'playwright-generated',
  // Include custom generated extension pattern (.pw.ts) in discovery
  testMatch: ['**/*.pw.ts', '**/*.spec.ts', '**/*.test.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  /* Run locally with headed UI by setting PWDEBUG=1 */
  use: {
    baseURL: 'https://electronic-repair.vercel.app',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] }
    }
  ],
  retries: 1,
  fullyParallel: true,
  workers: 4
});
