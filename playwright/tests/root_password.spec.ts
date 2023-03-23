import { test, expect } from '@playwright/test';
import { mainPagePath } from "../lib/installer";

test.describe('The user section', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(mainPagePath());
  });

  test('can set the root password', async ({ page }) => {
    // See https://playwright.dev/docs/api/class-locator

    // initial expectation - the root password is not configured yet
    await expect(page.getByText("None authentication method defined for root user")).toBeVisible();

    // click the "Users" header
    await page.locator("a[href='#/users']").click();

    // display the actions menu for the root password
    await page.locator("#actions-for-root-password").click();

    // click the "Set" item
    await page.getByRole("menuitem", { name: "Set" }).click();

    // fill a new password
    await page.locator('#password').fill('d-installer');
    await page.locator('#passwordConfirmation').fill('d-installer');
    await page.locator('button[type="submit"]').click();

    // wait until the popup is closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();

    // go back to the main page
    await page.getByText('Back').click();

    // check the summary text
    await expect(page.getByText("Root authentication set")).toBeVisible();
  });
})
