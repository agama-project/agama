# API compatibility policy

Agama's HTTP API and WebSocket events (`rust/agama-server`) are consumed by `agama-cli` and the web
UI. Since the server does not maintain backward compatibility for old API versions, clients built
against an older version must keep working against a newer server. We achieve this by making API
changes **additive only**: we extend existing objects and messages instead of changing or removing
what is already there.

## Scope

This policy applies from **API v2** onward (the point where the `X-API-Version` header was
introduced, shipped with Agama 24 / SLES 16.1). **SLES 16.0 (Agama 17, pre-versioning) is out of
scope** - that transition already broke compatibility before this policy existed, and it is not
something this policy retroactively fixes. `agama-cli` from SLES 16.0 is not expected to work
against current servers.

If bridging SLES 16.0 is ever genuinely needed, the recommended mechanism is a separately packaged,
frozen `agama-cli-legacy` (speaking Agama 17's API), not extending the current `agama-cli` or this
policy to cover it.

## The rule

Prefer extending existing types (`Config`, `SystemInfo`, `Event`, etc.) over changing them, and
avoid adding new endpoints unless there is no reasonable additive alternative.

**Allowed (additive) changes:**

- Adding a new optional field to an existing struct.
- Adding a new variant to an enum.
- Adding a new endpoint.

**Not allowed without a major version bump (see below):**

- Removing or renaming a field, endpoint, or enum variant.
- Changing the type or meaning of an existing field.
- Making a previously optional field required.

## Rules of thumb when writing API types

- New fields must be `Option<T>` or have `#[serde(default)]`, so older/newer peers that don't know
  about them simply skip them.
- Never add `#[serde(deny_unknown_fields)]` to a type exposed through the API.
- Tagged enums used in messages (e.g. `Event`, `rust/agama-utils/src/api/event.rs`) must have a unit
  `#[serde(other)]` fallback variant, so a client that doesn't recognize a new variant ignores it
  instead of failing to deserialize the message.
- Watch out for `#[serde(flatten)]`: fields flattened into the same JSON object (e.g. `Config`'s
  `storage`/`software`/`files`/`users`/`s390`) share one namespace. Adding a field with a name that
  already exists in a sibling flattened struct is a silent breaking change.

## Client-side responsibility: graceful degradation

Additive-only changes are safe at the wire level in both directions: an old client won't crash
reading a new server's response, and a new client won't crash reading an old server's response
(missing fields just deserialize as `None`). But that only means "no crash" - it says nothing about
what the client should *do* when a field it wants turns out to be absent because the server is
older. That is the client's responsibility, not something the wire format solves for you.

Example: a new `agama monitor` feature reads a new `SystemInfo` field. Against an older server, that
field deserializes as `None` - the client must detect that and fall back (previous behavior, or a
clear "requires a newer server" message), not assume the field is always present.

- Detect the capability from the **field itself** (`Option::is_none()`), not from `X-API-Version` -
  additive changes deliberately don't bump it, so the version number can't tell you whether a
  specific new field exists.
- Never `.unwrap()`/assume presence of a field introduced after the client's minimum supported
  server version.

This is the forward-direction counterpart of the additive-only rule: additive-only protects old
clients against new servers; graceful degradation protects new clients against old servers. Both are
required.

## What the client needs to know about

Not every API-facing type carries the same compatibility burden. Before applying the rules above,
classify what you're changing:

- **Interpreted by the client**: `Status`, `Stage`, `Scope`, `Progress`, `IssueWithScope`,
  `Question`/`Answer`/`QuestionField`/`AnswerRule`/`Policy`/`QuestionSpec`, `Event`,
  `ProblemDetails`, `FinishMethod`. The client actively branches on these (monitor UI, WebSocket
  event dispatch, interactive question answering), so the additive-only and graceful-degradation
  rules above are what protect it.
- **Opaque to the client**: `Config` and similarly-shaped domain objects. For `agama config
  show`/`load`/`edit`, the client reads/writes them as plain JSON without interpreting their
  structure - it never needs to understand a new field to keep working. This is exactly why an old
  client can push a config to a newer server with zero compatibility work. The one exception is
  `agama config generate`, which does construct a typed `Config` for source-resolution logic.
- **Local JSON Schema validation is the odd one out.** `agama config validate --local` validates
  against a JSON Schema bundled with the `agama-cli` package itself (version-pinned, not fetched
  from the server), and those schemas set `additionalProperties: false`. An old CLI's bundled schema
  can therefore reject a newer server's valid, additive config when run in `--local` mode. The
  default (non-`--local`) validation path delegates to the server and doesn't have this problem -
  this is a known, accepted limitation of offline validation, not of the live API.

When adding a new field, consider which category it falls into: if it's consumed only as opaque
JSON, there's nothing more to do; if the client is meant to interpret it, make sure it follows the
graceful-degradation rule above.

## When a breaking change is unavoidable

If a change genuinely cannot be additive, it must bump the API version (`X-API-Version` header,
`rust/agama-server/src/web/service.rs`) so clients can detect the incompatibility instead of failing
with an opaque error. This should be rare and treated as an exception, not a routine part of API
evolution.

## Reviewer checklist

- No new/changed field breaks deserialization for a peer that doesn't know about it.
- No enum variant was removed or renamed.
- No `deny_unknown_fields` was added.
- New/changed WebSocket events still deserialize safely on a client that doesn't recognize them.
- If a client feature depends on a new field, it degrades gracefully (no crash, no broken output)
  when talking to a server that doesn't have it yet.
- If breaking, the API version was bumped and the change is called out in the PR description.
