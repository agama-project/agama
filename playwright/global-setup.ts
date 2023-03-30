// See https://playwright.dev/docs/auth#reuse-signed-in-state
// and https://playwright.dev/docs/test-global-setup-teardown
import { expect, chromium, firefox, FullConfig, BrowserType, FullProject } from '@playwright/test';
const fs = require('fs');

function browserType(typeName:string):BrowserType {
  if (typeName === "firefox") {
    return firefox;
  } else if (typeName === "chromium") {
    return chromium;
  } else {
    throw new Error(`Unsupported browser type "${typeName}"`);
  }
}

// find the project (browser) to use for logging in:
// - specified by the "--project" command line option
// - or find the first installed browser
function findProject(config: FullConfig):FullProject {
  let project : FullProject;

  const optionIndex = process.argv.findIndex(a => a === "--project");
  if (optionIndex >= 0) {
    const projectName = process.argv[optionIndex + 1];
    project = config.projects.find(p => p.name === projectName && fs.existsSync(p.use.launchOptions.executablePath));
  }
  else {
    project = config.projects.find(p => fs.existsSync(p.use.launchOptions.executablePath));
  }

  if (project === undefined) {
    throw new Error("Web browser not found");
  }

  return project;
}

async function globalSetup(config: FullConfig) {
  // baseURL and storageState are the same for all projects, use the first one
  const { baseURL, storageState } = config.projects[0].use;
  // storage not configure => login was disabled
  if (storageState === undefined) return;

  const project = findProject(config);
  const browser = await browserType(project.use.defaultBrowserType).launch(project.use.launchOptions);
  const page = await browser.newPage({
    baseURL,
    ignoreHTTPSErrors: true
  });

  // go to the terminal app to see if the user needs to log into the system
  await page.goto("/cockpit/@localhost/system/terminal.html");

  // login page displayed?
  try {
    await page.waitForSelector("#login-user-input", { timeout: 5000 });
  }
  catch {
    // form not found, login not required
    return;
  }

  await page.getByLabel('User name').fill('root');
  await page.getByLabel('Password', { exact: true }).fill('linux');

  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page.getByLabel('Password', { exact: true })).not.toBeVisible();

  // Save the signed-in state to a file
  await page.context().storageState({ path: storageState as string });

  await browser.close();
}

export default globalSetup;
