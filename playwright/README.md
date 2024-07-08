## Integration Tests

This directory contains integration tests which use the [Playwright](
https://playwright.dev/) testing framework.

## Installation

To install the Playwright tool run this command in the `playwright` subdirectory:

```shell
npm install --no-save @playwright/test
```

This will install the NPM packages into the `node_modules` subdirectory.

Alternatively you can install it as an RPM package from the
[systemsmanagement:Agama:Devel](https://build.opensuse.org/project/show/systemsmanagement:Agama:Devel)
OBS project.

## Files

- `playwright.config.ts` - Playwright configuration, see [documentation](
  https://playwright.dev/docs/test-configuration) for more details
- `global-setup.ts` - a helper for logging-in
- `tests/\*.spec.ts` - individual test files
- `lib/*` - shared library files

## Running the Tests

*Note: If you install Playwright from the RPM package then omit the `npx`
tool from all commands below.*

By default the tests are used against the local running server, if you
want to test a remote server see the [Target Server](#target-server)
section below.

To run all tests use this command:

```
npx playwright test
```

To run just a specific test:

```
npx playwright test tests/root_password.spec.ts
```

By default it runs tests in all configured projects (browsers),
if you want to use only a specific browser use the `--project` option:

```
npx playwright test --project chromium -- tests/root_password.spec.ts
```

See the `playwright.config.ts` file for the list of configured projects.

### Running Tests Directly from the Live ISO

You can download the `openSUSE-Playwright` image type from the [systemsmanagement:Agama:Devel](
https://download.opensuse.org/repositories/systemsmanagement:/Agama:/Devel/images/iso/) repository.

This ISO additionally includes the Playwright tool, Chromium browser and the
Agama integration tests.

To start a test in a console or in a SSH session use this command:

```
playwright test --project chromium --config /usr/share/agama-playwright <test>
```

*Note the missing `npx` tool in the command, in this case Playwright is
installed into the system directories.*

You can also start the tests in headed mode (with `--headed` option) either
via `ssh -X` or using a local X terminal session:

```shell
# from a Linux console
DISPLAY=:0 xterm &
# then switch to console 7 using the Alt+F7 keyboard shortcut
# and run Playwright from the xterm
```

## Updating the Screenshots

There is one test specially designed for refreshing the screenshots displayed
in the main `README.md` file.

To fully run the installation type this:

```
SCREENSHOT_MODE=1 RUN_INSTALLATION=1 BASE_URL=https://<host>:9090 npx playwright test --headed --project chromium take_screenshots
```

The `--headed` option shows the browser window so you can see the progress.
You can use the `--debug` option to run the test step-by-step.

The screenshots are saved to the `screenshots/` subdirectory.

## Target Server

By default the tests use the installer instance running locally at
`http://localhost:9090`. If you want to run the tests against
another instance set the `BASE_URL` environment variable:

```
BASE_URL=https://192.168.1.12:9090 npx playwright ...
```

You can use it also with the [webpack development server](
../web/README.md#using-a-development-server):

```
BASE_URL=https://localhost:8080/ npx playwright ...
```

### Options

The tests by default run in a headless mode, if you want to see the actions
in the browser use the `--headed` option.

If you want to manually run a test step by step use the `--debug` option. This
also allows to easily get the object selectors using the `Explore` button.

## Links

- https://playwright.dev/docs/intro - Playwright Documentation
- https://playwright.dev/docs/test-assertions - Test assetions (`expect`)
- https://playwright.dev/docs/api/class-locator - Finding the elements on the page

## Tips for Writing Tests

The installer runs in another process in a browser, it does not run
synchronously with the test. Additionally the installer uses the React
framework, that means the initial web page is empty and the content is added
asynchronously by Javascript code.

These features have some consequences for writing the tests.

### Timeouts

As mentioned above, the page content is updated asynchronously so if something
is missing on the page it does not mean the test fails immediately.
The tested object might appear on the page after a small delay,
Playwright uses timeouts for most of the checks. If something is missing
then it tries the search again until the timeout is reached.

The default timeout is set in the `playwright.config.ts` configuration file.
That should be enough for most operations even on a slow machine.
However, for some long running operations like refreshing repositories or
installing packages you might need to use a longer timeout.

Playwright allows setting explicit timeout for each test or action:

```js
// refreshing the repositories and evaluating the package dependencies might take long time
await expect(page.getByText("Installation will take")).toBeVisible({timeout: 2 * minute});
```

or you can set how long the whole test should run:

```js
test.setTimeout(60 * minute);
```

### Testing Not Displayed Elements

This is also related to the asynchronous work. You should never test that something
is NOT displayed on the page because it is not guaranteed that it will not
be displayed one millisecond after you check for it.

The only exception is that you first check that an element is displayed, do some
action and then check that the element is not displayed anymore.

```js
// clicking a 'Details' button
await page.getByText('Details').click();
// opens a modal dialog (popup)
await expect(page.locator('[role="dialog"]')).toBeVisible();

// after clicking the 'Close' button
await page.getByText('Close').click();
// the popup disappears
await expect(page.locator('[role="dialog"]')).not.toBeVisible();
```

The last check actually waits until the popup disappears. It is OK if it takes
some short time to close the popup.

### Locators

By default the text locators search for a *substring*! If there are similar
labels present you might get errors for multiple elements found.

For example when there are "Password" and "Password Confirmation" fields
displayed on the page then simple

```js
await page.getByLabel('Password').click()
```

would actually match *both* elements and Playwright would not know which one you
wanted to click. In that case the test would fail with an error.

The solution is to use the exact matching:

```js
await page.getByLabel('Password', { exact: true }).click()
```

This will match only one field without any conflict.

## Troubleshooting Failed Integration Tests in CI

### Single Test Failure

There are stored artifacts in the GitHub CI. Go to the failed job and there is
a link "Summary". At the bottom of the page there is "Artifacts" section which
contains the `y2log` and also `trace.zip` file. The trace can be browsed using
the playwright tool locally or at page https://trace.playwright.dev/ to get
details of the failure.

### Stuck at D-Bus Loading

It usually indicates an issue with the Agama D-Bus services. There is a step
called "Show D-Bus Services Logs" which should give a hint what is going wrong.
Additional help can be the `y2log` file in the artifacts (see above).

### Missing Package/Wrong Container

Packages lives in container at https://build.opensuse.org/package/show/systemsmanagement:Agama:Devel/agama-testing.
Feel free to modify it as the only purpose of this container is CI testing.
