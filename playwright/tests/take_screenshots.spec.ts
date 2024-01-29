import { test, expect } from "@playwright/test";
import { mainPagePath } from "../lib/installer";

// This test was designed for collecting the screenshots for the main
// README.md file. To take screenshots of the installation process run this:
// 
//   RUN_INSTALLATION=1 BASE_URL=https://<host> npx playwright test --headed take_screenshots
// 
// The "--headed" option shows the browser window so you can see the progress.
// You can use the "--debug" option to run the test step-by-step.
// The screenshots are saved to the "screenshots/" subdirectory.

// minute in miliseconds
const minute = 60 * 1000;

test.describe("The Installer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(mainPagePath());
  });

  test("installs the system", async ({ page }) => {
    // maximum time for this test to run
    test.setTimeout(60 * minute);

    if (process.env.SCREENSHOT_MODE === "1") {
      // set screenshot size to 768x1024
      page.setViewportSize({ width: 768, height: 1024 });
    }

    // optional actions done on the page
    const actions = Object.freeze({
      setProduct: Symbol("product"),
      setPassword: Symbol("password"),
      done: Symbol("done")
    });

    // check for multiple texts in parallel, avoid waiting for timeouts
    let action = await Promise.any([
      page.getByText("Product selection").waitFor().then(() => actions.setProduct),
      page.getByText("No root authentication method").waitFor().then(() => actions.setPassword),
      page.getByText("Root authentication set").waitFor().then(() => actions.done),
    ]);

    // optional product selection
    if (action === actions.setProduct) {
      await test.step("Select the product", async () => {
        // select openSUSE Tumbleweed
        await page.getByText("openSUSE Tumbleweed").click();
        await page.screenshot({ path: "screenshots/product-selection.png" });
        await page.getByRole("button", { name: "Select" }).click();
      });

      // update the action for the next step
      action = await Promise.any([
        page.getByText("No root authentication method").waitFor().then(() => actions.setPassword),
        page.getByText("Root authentication set").waitFor().then(() => actions.done),
      ]);
    }

    if (action === actions.setPassword) {
      // the the root password must be set
      await test.step("Set the root password", async () => {
        await page.locator("a[href='#/users']").click();
        // Create users page screenshot
        await page.screenshot({ path: "screenshots/users-page.png" });
        // click on the "Set a password" button
        await page.getByRole("button", { name: "Set a password" }).click();
        await page.locator("#password").fill("linux");
        await page.locator("#passwordConfirmation").fill("linux");
        await page.locator('button[type="submit"]').click();
        await page.getByText("Back").click();
      });
    }

    // ensure the software proposal is ready, use longer timeout,
    // refreshing the repositories takes some time
    await expect(page.getByText("Installation will take")).toBeVisible({timeout: 2 * minute});
    await page.screenshot({ path: "screenshots/overview.png" });

    await test.step("Storage configuration", async () => {
      // create storage page screenshot
      await page.locator("a[href='#/storage']").click();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      // skip this in GitHub CI, there is no suitable disk for installation
      if (process.env.GITHUB_ACTIONS !== "true") {
        await expect(page.getByText("Installation device")).toBeVisible({timeout: minute / 2});
      }
      await page.screenshot({ path: "screenshots/storage-page.png" });
    });

    // confirm the installation only when explicitly set via the environment
    if (process.env.RUN_INSTALLATION === "1") {
      await test.step("Run installation",  async () => {
        // start the installation
        await page.getByRole("button", { name: "Install", exact: true }).click();
        await expect(page.getByText("Confirm Installation")).toBeVisible();
        await page.getByRole("button", { name: "Continue" }).click();
        
        // wait for the package installation progress
        await expect(page.getByText("Installing packages")).toBeVisible({timeout: 5 * minute});

        // create package installation screenshot every half a minute
        let screenshot_index = 0;
        while (true) {
          await page.screenshot({ path: `screenshots/installation_${screenshot_index++}.png` });
          
          try {
            await page.getByRole("heading", { name: "Congratulations!" }).waitFor({timeout: minute / 2});
            // the finish screen is displayed
            await page.screenshot({ path: "screenshots/finished.png" });
            break;
          }
          catch (error) {
            // do not ignore other errors
            if (error.constructor.name !== "TimeoutError") throw(error);
          }
        }
      });
    }
  });
})
