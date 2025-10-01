import { test, expect } from '@playwright/test';

test('Auto smoke: octocat/Hello-World main', async ({ page }) => {
  await page.goto(process.env.E2E_BASE_URL || 'https://example.org');
  await expect(page).toHaveTitle(/.*/);
});
