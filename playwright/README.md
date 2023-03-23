## Integration Tests

This directory contains integration tests which use the [Playwright](
https://playwright.dev/) testing framework.

## Installation

To install the Playwright tool run this command in the `playwright` subdirectory:

```shell
npm install
```

This will install the NPM packages into the `node_modules` subdirectory
and download the browsers into the `~/.cache/ms-playwright` directory.

*Note: The downloaded browsers need almost 1GB, make sure you have enough
space in your `$HOME` directory.*

## Files

- `playwright.config.ts` - Playwright configuration, see [documentation](
  https://playwright.dev/docs/test-configuration) for more details
- `global-setup.ts` - a helper for logging-in
- `tests/\*.spec.ts` - individual test files
- `lib/*` - shared library files

## Running the Tests

To run all tests use this command:

```
npx playwright test
```

To run just a specific test:

```
npx playwright test tests/root_password.spec.ts
```

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

## Troubleshooting Failed Integration Tests in CI

### Single Test Failure

There are stored artifacts in the GitHub CI. Go to the failed job and there is
a link "Summary". At the bottom of the page there is "Artifacts" section which
contains the `y2log` and also `trace.zip` file. The trace can be browsed using
the playwright tool locally or at page https://trace.playwright.dev/ to get
details of the failure.

### Stuck at D-Bus Loading

It usually indicates an issue with the D-Installer D-Bus services. There is a step
called "Show D-Bus Services Logs" which should give a hint what is going wrong.
Additional help can be the `y2log` file in the artifacts (see above).

### Missing Package/Wrong Container

Packages lives in container at https://build.opensuse.org/package/show/YaST:Head:Containers/d-installer-testing .
Feel free to modify it as the only purpose of this container is CI testing.
