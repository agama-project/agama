#! /bin/sh

# This is a helper script which deletes some not needed files from NPM packages.
# This script is specific for Puppeteer installations.

MODULES_PATH="${1:-./node_modules}"

# delete Puppeteer CommonJS modules, we use the ES modules (in lib/esm)
rm -rf "$MODULES_PATH/puppeteer-core/lib/cjs"
