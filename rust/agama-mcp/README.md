# Agama MCP Server (`agama-mcp`)

Embedded Model Context Protocol (MCP) server for the Agama installer live environment.

## Overview

`agama-mcp` exposes Agama's hardware probe, configuration validation, installation proposal,
installation execution, progress monitoring, and log retrieval capabilities as standardized
Model Context Protocol tools over HTTP Server-Sent Events (SSE).

This allows AI orchestration tools (such as Uyuni or remote CLI agents) to interact with
Agama dynamically and safely during bare-metal deployment.

## Bootstrapping & Kernel Command-Line

The MCP server is **disabled by default** to minimize attack surface. It is activated
via the kernel command-line:

- `inst.mcp=full`: Enables full MCP access, including the ability to trigger installation (`commit_install`).
- `inst.mcp=readonly`: Strict read-only mode. AI tools can inspect hardware, inject trial profiles, and check proposals, but `commit_install` is disabled (returning a `403 Forbidden` error), requiring approval by a human in the Web UI.

## Tools Provided

1. `get_system(resource?)`: Queries hardware probe engines (storage, network, hardware, software). Accepts an optional `resource` filter to prevent blowing out AI context windows.
2. `set_config(config)`: Injects an Agama profile, validating against the JSON schema (returning JSON-RPC `-32602` on invalid params or schema failure).
3. `get_proposal()`: Commands Agama to calculate the final installation plan. Returns `proposal_computing` if background solvers are running, plan diffs on completion, or issues if the configuration is impossible.
4. `commit_install()`: Locks state machine and triggers disk format and software installation. Forbidden in read-only mode.
5. `get_progress()`: Returns structured completion percentage, current stage, background tasks, and pending questions (`hasPendingQuestions`, `pendingQuestions`).
6. `get_logs(log_type?, lines?)`: Retrieves scoped system logs directly from `journalctl` (defaulting to the last 100 lines, max 1000). Supported scopes: `installer` (default, queries `agama*` units), `system` (system-wide journal), `zypp` (package manager entries), or any specific systemd unit name.
7. `get_questions()`: Retrieves interactive questions raised by installer services awaiting an answer (e.g. disk decryption, GPG key import, package retry).
8. `answer_question(id, action, value?)`: Submits an answer to a pending question by ID to unblock installer progress.

## Security & Authentication

The MCP route (`/mcp`) is mounted directly within Agama's embedded HTTPS server and shares Agama's
native session authentication (`auth_middleware`).

Before connecting to `/mcp`, the AI client obtains a Bearer token via `/login` and provides it in
the `Authorization` header:

```json
{
  "mcpServers": {
    "agama-baremetal": {
      "url": "https://<agama-ip>/mcp",
      "requestOptions": {
        "headers": {
          "Authorization": "Bearer <TOKEN>"
        }
      }
    }
  }
}
```
