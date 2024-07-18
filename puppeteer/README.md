# Agama Integration Tests

This is directory contains support writing integration tests for Agama. It is
based on the [Puppeteer](https://pptr.dev/) library.

Currently there is only one simple test which only selects the product to
install and sets the root password. More tests will be implemented separately in
the openQA, this package basically just ensures that the needed libraries and
tools are present on the Live ISO.

## Running Tests

The integration tests can be started from a Git checkout or from a Live ISO.

### Live ISO

To run the test from Live ISO:

```sh
agama-integration-tests /usr/share/agama/integration-tests/tests/test_root_password.js
```

This runs a headless test which expects the Agama is running on the local
machine. See the [Options](#options) section below how to customize the test
run.

### Git

To run the test directly from Git checkout:

```sh
./agama-integration-tests tests/test_root_password.js
```

At the first run it installs Puppeteer and the dependant NPM packages. You can
install them manually with this command:

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm install --omit=optional
```

## Options

The recommended command to run the test during development is

```sh
AGAMA_BROWSER=chromium AGAMA_SERVER=https://agama.local AGAMA_SLOWMO=50 \
AGAMA_HEADLESS=false ./agama-integration-tests tests/test_root_password.js
```

The options are described below.

### Test Browser

By default the test uses the Firefox browser but it is possible to use Chromium
or Google Chrome as well. See the [supported browsers](#supported-browsers)
section below.

Set `AGAMA_BROWSER=chromium` or `AGAMA_BROWSER=chrome` to use different
browsers.

### Headless Mode

The test runs in headless mode (no UI displayed). For development or debugging
it might be better to see the real browser running the test.

Set `AGAMA_HEADLESS=false` to display the browser during the test.

When running the test from the Live ISO you need to enable the X forwarding
(`ssh -X` option) or set `DISPLAY=:0` to use the locally running X server.

### Target Agama Server

The test connects to a locally running Agama, for using a remote server set
the `AGAMA_SERVER` to the server URL.

### Slow Motion

Because the browser is controlled by a script the actions might be too fast to
watch. Use the `AGAMA_SLOWMO` variable with a delay in miliseconds between the
actions. A reasonable value is round 50.

## Supported Browsers

The Puppeteer library was originally written for the Chromium browser, but later
they added support also for the Firefox browser. However, not all features might
be supported in Firefox, e.g. it cannot record a video of the test run. See
more details in the [Puppeteer documentation](https://pptr.dev/webdriver-bidi).

> [!NOTE]
Unfortunately the Firefox version installed in SLE15 and openSUSE Leap 15.x is
too old and does not work with Puppeteer. The version in openSUSE Tumbleweed
works fine.
