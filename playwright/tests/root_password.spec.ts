import { test, expect } from '@playwright/test';

test.describe('The user section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cockpit/@localhost/d-installer/index.html');
  });

  test('can set the root password', async ({ page }) => {
    // See https://playwright.dev/docs/selectors#text-selector
    // click the button
    await page.locator('.overview-users p').locator('text=Root password is').locator('button').click();

    // fill a new password
    await page.locator('#password').fill('d-installer');
    await page.locator('#passwordConfirmation').fill('d-installer');
    await page.locator('button[type="submit"]').click();

    // wait until the dialog is closed
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);

    // check the summary text
    await expect(page.locator('.overview-users p').locator('text=Root password is set')).toHaveCount(1);
  });
})
