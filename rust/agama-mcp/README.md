# Agama MCP Server (`agama-mcp`)

Embedded Model Context Protocol (MCP) server for the Agama installer
live environment.

## Overview

`agama-mcp` exposes Agama's hardware probe, configuration validation,
installation proposal, installation execution, progress monitoring, and
log retrieval capabilities as standardized Model Context Protocol tools
over HTTP Server-Sent Events (SSE).

This allows AI orchestration tools (such as Uyuni or remote CLI agents)
to interact with Agama dynamically and safely during bare-metal
deployment.

## Bootstrapping & Kernel Command-Line

The MCP server is **disabled by default** to minimize attack surface. It
is activated via the kernel command-line:

-   `inst.mcp=full`: Enables full MCP access, including the ability to
    trigger installation (`commit_install`).
-   `inst.mcp=config`: Configuration-only mode. AI tools can inspect
    hardware, retrieve schemas, inject profiles, and check proposals,
    but `commit_install` is disabled (returning a `403 Forbidden`
    error), requiring approval and triggering of installation by a human
    operator in the Web UI. (If you are looking for a `read-only` mode,
    this is it, with respect to the target system.)
-   `inst.mcp=disabled` (or omitted): MCP server is disabled.

## Tools Provided

1.  `get_config_schema(section?)`: Retrieves the JSON Schema for the
    Agama installation profile. Called without arguments, returns an
    overview of all top-level sections and minimal examples. Accepts an
    optional `section` filter (e.g. `storage`, `software`, `access`,
    `network`, `user`, `bootloader`) to inspect field-level constraints,
    types, and allowed enum values.
2.  `get_system(resource?)`: Queries hardware probe engines (storage,
    network, hardware, software). Accepts an optional `resource` filter
    to prevent blowing out AI context windows.
3.  `set_config(config)`: Injects an Agama profile, validating against
    the JSON schema. Replaces current configuration state.
4.  `get_proposal()`: Commands Agama to calculate the final installation
    plan. Returns `proposal_computing` if background solvers are
    running, plan diffs on completion, or issues if the configuration is
    impossible.
5.  `commit_install()`: Locks state machine and triggers disk format and
    software installation. Forbidden in configuration mode.
6.  `get_progress()`: Returns structured completion percentage, current
    stage, background tasks, and pending questions
    (`hasPendingQuestions`, `pendingQuestions`).
7.  `get_logs(log_type?, lines?)`: Retrieves scoped system logs directly
    from `journalctl` (defaulting to the last 100 lines, max 1000).
    Supported scopes: `installer` (default, queries `agama*` units),
    `system` (system-wide journal), `zypp` (package manager entries), or
    any specific systemd unit name.
8.  `get_questions()`: Retrieves interactive questions raised by
    installer services awaiting an answer (e.g. disk decryption, GPG key
    import, package retry).
9.  `answer_question(id, action, value?)`: Submits an answer to a
    pending question by ID to unblock installer progress.

## Resources Provided

-   `agama://schema/config.json`: The complete JSON Schema for the Agama
    unattended installation profile (MIME type
    `application/schema+json`). Available via standard MCP
    `resources/list` and `resources/read`.

## Security & Token Isolation

To prevent an AI agent from introspecting its configured Bearer token
and using `curl` to call the general Agama REST API (`/api/...`) to
bypass MCP safety boundaries, Agama enforces strict **Token Isolation**:

-   The MCP route (`/mcp`) authenticates requests exclusively against a
    dedicated MCP token (`mcp_token`).
-   Any attempt to use the MCP token against `/api/...` endpoints is
    strictly rejected with `401 Unauthorized`.
-   The MCP token can be pre-shared via `inst.mcp.token=<SECRET>` on the
    kernel command line, or read locally from `/run/agama/mcp-token` on
    the target host (permissions 0400).

Configure the AI client (e.g., Gemini CLI) with the dedicated MCP token:

``` json
{
  "mcpServers": {
    "agama-baremetal": {
      "url": "https://<agama-ip>/mcp",
      "headers": {
        "Authorization": "Bearer <DEDICATED_MCP_TOKEN>"
      }
    }
  }
}
```
