# JSON schema definition

See the [JSON schema documentation](https://json-schema.org/docs) for more details. The Agama
schemas uses the [Draft 2019-09](https://json-schema.org/draft/2019-09) version.

## Autoinstallation profile

The Agama autoinstallation profile JSON schema is defined in these files:

- [profile.schema.json](./profile.schema.json) (the main definition)
- [storage.schema.json](./storage.schema.json) (referenced from the main definition)
- [iscsi.schema.json](./iscsi.schema.json) (referenced from the main definition)

## Agama REST API

The [storage.model.schema.json](./storage.model.schema.json) file describes the structure of the
storage data passed via the internal REST API. This is important only for Agama developers, it is
not intended to be used by end users.

## Validation

To verify that the definitions are correct run these commands:

```sh
# install needed NPM packages
npm ci

# verify the schema
npm run validate
```

These commands are run in the CI automatically whenever a schema file is modified.
