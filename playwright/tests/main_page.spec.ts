import { test, expect } from '@playwright/test';
import { mainPagePath } from "../lib/installer";

test.describe('The main page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(mainPagePath());
  });

  test('has the "Agama" title', async ({ page }) => {
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Agama/);
  });

  test('has the Install button', async ({ page }) => {
    await page.getByRole('button', { name: 'Install' }).isVisible();
  });
})
