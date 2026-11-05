# API compatibility policy

Agama's HTTP API and WebSocket events (`rust/agama-server`) are consumed by `agama-cli` and the web
UI. The server retains backward compatibility: clients built against an older version keep working
against a newer server. We achieve this by making API changes **additive only**: we extend existing
objects and messages instead of changing or removing what is already there. The server carries no
adapters or multiple API dialects.

A newer client talking to an older server is covered by **graceful degradation** on the client side
(see below). Both directions are supported.

## Scope

This policy applies from **API v2** onward (Agama 24 / SLES 16.1). SLES 16.0 (Agama 17) is out of
scope; its `agama-cli` is not expected to work against current servers.

## The rule

Prefer extending existing types over changing them, and avoid adding new endpoints unless there is
no reasonable additive alternative.

**Allowed (additive) changes:**

- Adding a new optional field to an existing struct.
- Adding a new variant to an enum, but only if clients that deserialize that enum tolerate unknown
  variants (e.g. a `#[serde(other)]` fallback).
- Adding a new endpoint.

**Not allowed without bumping the API version (see below):**

- Removing or renaming a field, endpoint, or enum variant.
- Changing the type or meaning of an existing field.
- Making a previously optional field required.

## Rules of thumb when writing API types

- New fields must be `Option<T>` or have `#[serde(default)]`.
- Never add `#[serde(deny_unknown_fields)]` to a type exposed through the API.
- Tagged enums used in messages (e.g. `Event`) must have a unit `#[serde(other)]` fallback variant,
  so a client that doesn't recognize a new variant ignores it instead of failing.
- Watch out for `#[serde(flatten)]` (e.g. in `Config`): flattened structs share one JSON namespace,
  so adding a field whose name exists in a sibling flattened struct is a silent breaking change.

## Client-side responsibility: graceful degradation

Additive changes avoid crashes in both directions, but a client must still decide what to do when a
field it wants is absent because the server is older (e.g. a new `SystemInfo` field deserializes as
`None`): fall back to the previous behavior or report "requires a newer server".

- Detect the capability from the **field itself** (`Option::is_none()`), not from `X-API-Version`;
  additive changes don't bump it.
- Never `.unwrap()`/assume presence of a field introduced after the client's minimum supported
  server version.

## What the client needs to know about

- **Interpreted by the client** (monitor UI, event dispatch, questions, errors): status, progress,
  issues, questions, `Event`, `ProblemDetails`, etc. The rules above protect these.
- **Opaque to the client**: `Config` and similar domain objects. All `agama config` commands
  (`show`, `load`, `edit`, `generate`) must handle them as plain JSON (`serde_json::Value`), never
  through the typed `Config`, which would silently drop fields the client doesn't know (and `edit`
  would erase them on the server). If a command has to touch part of the config (e.g. `generate`
  resolving relative URLs), it must change only those values and leave the rest untouched.
- **Local validation**: `agama config validate --local` uses JSON Schemas bundled with the CLI,
  which set `additionalProperties: false`, so an old CLI can reject a newer server's valid config.
  This is a known limitation of offline validation; the default path validates on the server.

## When a breaking change is unavoidable

It must bump the API version (the `X-API-Version` header) so clients can detect the incompatibility
instead of failing opaquely. This should be rare.

## Reviewer checklist

- No new/changed field breaks deserialization for a peer that doesn't know about it.
- No enum variant was removed or renamed, and any added variant is tolerated by clients.
- No `deny_unknown_fields` was added.
- New/changed WebSocket events deserialize safely on a client that doesn't recognize them.
- Client features depending on a new field degrade gracefully against older servers.
- If breaking, the API version was bumped and the change is called out in the PR description.
