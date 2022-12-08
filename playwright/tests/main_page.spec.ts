import { test, expect } from '@playwright/test';

test.describe('The main page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cockpit/@localhost/d-installer/index.html');
  });

  test('has the "D-Installer" title', async ({ page }) => {
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/D-Installer/);
  });

  test('has the Install button', async ({ page }) => {
    await page.getByRole('button', { name: 'Install' }).isVisible();
  });
})
