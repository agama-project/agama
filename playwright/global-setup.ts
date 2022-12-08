// See https://playwright.dev/docs/auth#reuse-signed-in-state
import { expect, chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  if (process.env.SKIP_LOGIN) return;

  const browser = await chromium.launch();
  const page = await browser.newPage({
    baseURL: process.env.BASE_URL || 'http://localhost:9090',
    ignoreHTTPSErrors: true
  });

  await page.goto('/cockpit/@localhost/d-installer/index.html');

  await page.getByLabel('User name').fill('root');
  await page.getByLabel('Password').fill('linux');

  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByLabel('Password')).toHaveCount(0);

  // Save signed-in state to 'storageState.json'.
  await page.context().storageState({ path: 'storageState.json' });

  await browser.close();
}

export default globalSetup;
