import { test, expect } from '@playwright/test';
import { mainPagePath } from "../lib/installer";

test.describe('The user section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(mainPagePath());
  });

  test('can set the root password', async ({ page }) => {
    // See https://playwright.dev/docs/api/class-locator

    // initial expectation - the root password is not configured yet
    await expect(page.getByText("No root authentication method defined")).toBeVisible();

    // click the "Users" header
    await page.locator("a[href='#/users']").click();

    // click on the "Set a password" button
    await page.getByRole("button", { name: "Set a password" }).click();

    // fill a new password
    await page.locator('#password').fill('agama');
    await page.locator('#passwordConfirmation').fill('agama');
    await page.locator('button[type="submit"]').click();

    // wait until the popup is closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // go back to the main page
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    // check the summary text
    await expect(page.getByText("Root authentication set")).toBeVisible();
  });
})
