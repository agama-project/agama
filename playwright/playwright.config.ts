import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: './tests',
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 60 * 1000
  },
  /* Do not run tests in files in parallel by default */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Because of test dependencies or race conditions run all tests in sequence, */
  /* later we could use a serial-parallel approach using the test lists, */
  /* see https://playwright.dev/docs/test-parallel#use-a-test-list-file */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.GITHUB_ACTIONS ? 'github' : 'list',
  globalSetup: require.resolve('./global-setup'),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 30000,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:9090',

    /* load signed-in state from 'storageState.json' */
    storageState: process.env.SKIP_LOGIN ? undefined : 'storageState.json',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          ignoreHTTPSErrors: true
        },
        launchOptions: {
          executablePath: '/usr/bin/chromium',
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        contextOptions: {
          ignoreHTTPSErrors: true
        },
        launchOptions: {
          executablePath: '/usr/bin/firefox',
        },
      },
    },
  ],
};

export default config;
