# JSON schema definition

This directory contains a JSON schema definition for the autoinstallation profiles.

See the [JSON schema documentation](https://json-schema.org/docs) for more details. The Agama schema
uses the [Draft 2019-09](https://json-schema.org/draft/2019-09) version.

## Validation

To verify that the definition is correct run these commands:

```sh
# install needed NPM packages
npm ci

# verify the schema
npm run validate
```

These commands are run in the CI automatically whenever a schema file is modified.
