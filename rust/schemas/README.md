# Human-Written Partial JSON Schemas

This directory contains human-written JSON schemas (Draft 2019-09) defining subsystems managed by the Ruby storage service and s390 tooling. These partial schemas are statically embedded into OpenAPI specifications and generated standalone schemas during build.

## Files

### Configuration Schemas
- `storage.schema.json`: User storage configuration (partitions, LVM volume groups, MD RAID, filesystems, mount points, encryption).
- `iscsi.schema.json`: iSCSI initiator and target configurations.
- `dasd.schema.json`: s390 DASD device configurations.
- `zfcp.schema.json`: s390 zFCP device configurations.

### Proposal & Device Schemas
- `proposal.storage.schema.json`: Storage proposal schema calculated by the backend service.
- `device.storage.schema.json`: Shared block device definitions referenced by storage proposals and system inventory.
- `storage.model.schema.json`: Internal storage calculation model schema for REST and D-Bus APIs.

### System Inventory Schemas
- `system.storage.schema.json`: Probed host block devices, partitions, and filesystems.
- `system.bootloader.schema.json`: Host bootloader status and capabilities.
- `system.iscsi.schema.json`: Active host iSCSI sessions and nodes.
- `system.dasd.schema.json`: Discovered host DASD devices and channel IDs.
- `system.zfcp.schema.json`: Discovered host zFCP adapters, ports, and LUNs.

## OpenAPI & Final Schema Generation

The build pipeline unifies Rust-derived schemas with these partial schemas:

1. **Schema Import & Extraction (`agama-server::web::docs::build`)**:
   - Rust configuration structs implement `schemars::JsonSchema`.
   - `docs::build()` reads the partial schemas in this directory, extracts their `$defs` with unique prefixed names to prevent collisions (e.g. `DasdConfigDevice` vs `DasdSystemInfoDevice`), and imports them as schema components under `/components/schemas/`.
   - References like `device.storage.schema.json` are rewritten to `#/components/schemas/StorageDevice`.
   - Injects compatibility aliases (`#[serde(alias)]`) and deprecations into component properties.

2. **Full Resolution (`cargo xtask openapi`)**:
   - Emits `out/openapi_full.json` and `out/openapi_full.yaml`: monolithic, self-contained specifications without external schema references.

3. **Schema Extraction (`cargo xtask openapi`)**:
   - Extracts standalone root schemas into `out/schemas/`:
     - `config.schema.json`: Standalone autoinstallation profile schema.
     - `proposal.schema.json`: Standalone proposal schema.
     - `system.schema.json`: Standalone system inventory schema.
   - Replaces the extracted components in `out/openapi.json` and `out/openapi.yaml` with `$ref: "schemas/<file>"`.

4. **Validation Target (`ProfileValidator`)**:
   - Profile validation targets `config.schema.json` directly (via `/usr/share/agama/openapi/nightly/schemas/config.schema.json` in production, or `out/schemas/config.schema.json` in development).

## Validation

Verify that the partial schemas compile without syntax or reference errors:

```sh
npm ci
npm run validate
```
