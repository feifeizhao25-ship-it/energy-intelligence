import { expect, test } from '@playwright/test';

test('CN production surface renders a Chinese user journey', async ({ page }) => {
  const response = await page.goto('http://127.0.0.1:3101', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).toContainText(/[一-鿿]/);
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error/i);
  await expect(page.locator('html')).toHaveAttribute('lang', /zh/i);
});

test('global seven-day journey exposes five personas and seven selectable days', async ({ page }) => {
  const response = await page.goto('http://127.0.0.1:3102/experience-week', { waitUntil: 'networkidle' });
  expect(response?.ok()).toBeTruthy();
  const personas = page.locator('aside button');
  const days = page.locator('[aria-label="Seven-day personalization journey"] button');
  await expect(personas).toHaveCount(5);
  await expect(days).toHaveCount(7);
  await personas.nth(4).click();
  await days.nth(6).click();
  await expect(personas.nth(4)).toHaveAttribute('aria-pressed', 'true');
  await expect(days.nth(6)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('body')).not.toContainText(/[一-鿿]/);
});
