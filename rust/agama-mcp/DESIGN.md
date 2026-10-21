# Agama MCP Server — Technical Design Specification

**Status:** Draft v1.0\
**Context:** Project AIRI (AI-Orchestrated OS Provisioning)

------------------------------------------------------------------------

## 1. Overview & Architecture

Embeds a Model Context Protocol (MCP) server directly inside Agama's web
server process, exposing installer primitives to AI orchestrators.

-   **Transport:** Streamable HTTP (`/mcp`). Uses HTTP POST with direct
    `application/json` responses for tool discovery and execution, and
    Server-Sent Events (SSE) for server notifications.
-   **Internal Binding:** Direct actor calls to `agama-manager` and
    `question-service`; source of truth remains Agama's core solver and
    state machine.
-   **Error Model:** Tool execution errors (schema invalidity, parameter
    errors, solver issues) return `CallToolResult` with `isError: true`
    so the AI can self-correct in-context. Protocol errors
    (`403 Forbidden`) are reserved for permission boundary violations.

------------------------------------------------------------------------

## 2. Bootstrapping & Modes

Disabled by default. Activated via kernel command line:

-   `inst.mcp=full`: Unrestricted access, including installation commit
    (`commit_install`).
-   `inst.mcp=config`: Configuration-only mode. All tools active except
    `commit_install`, which returns `403 Forbidden`. A human must
    approve and trigger installation in the Web UI.
-   `inst.mcp=disabled` (default): MCP server is disabled.

------------------------------------------------------------------------

## 3. Tool & Resource Specification

### Phase 1: Hardware Probing

-   `get_system(resource?)`: Returns hardware inventory JSON. Optional
    `resource` filter (`storage`, `network`, `software`, `hardware`,
    etc.) prevents context window exhaustion.

### Phase 2: Schema Discovery & Profile Configuration

-   `get_config_schema(section?)`: Returns profile JSON Schema.
    -   `section: None`: Overview of top-level sections (`product`,
        `software`, `storage`, `access`, `user`, `root`, `network`,
        `bootloader`, etc.) and minimal valid profile (`product` +
        `root.password`).
    -   `section: Some("...")`: Field-level schema, constraints, and
        enums for that specific subsystem.
-   Resource `agama://schema/config.json`: Complete profile JSON Schema
    (`application/schema+json`) via MCP `resources/list` and
    `resources/read`.
-   `set_config(config)`: Injects complete profile JSON, validating
    against schema. Execution errors return `isError: true` with
    validator messages.

#### Schema Strategy (Producer vs. Consumer)

-   **`Config` (AI as Producer):** Needs strict schemas
    (`get_config_schema`, resource) so the model does not hallucinate
    keys or enums (`access`, `ssh`, `enabled`, `default`).
-   **`System` & `Proposal` (AI as Consumer):** LLMs naturally parse
    structured output JSON. Exposing \~200KB of read-only schemas wastes
    context tokens without improving decisions. Lightweight filters and
    state discriminator tags are used instead.

### Phase 3: Proposal Verification

-   `get_proposal()`: Triggers and returns installation calculation
    plan.
    -   Tagged states: `proposal_computing` (solvers active),
        `proposal_ready` (diff/plan), `issues_detected` (conflict list),
        or `proposal_pending`.

### Phase 4: Execution & Observability

-   `commit_install()`: Starts disk partitioning and deployment.
    Forbidden in `config` mode (`403 Forbidden`).
-   `get_progress()`: Returns percentage, stage (`Configuring`,
    `Installing`, `Finished`, `Failed`), tasks, and pending questions.
-   `get_questions()`: Returns currently pending, unanswered interactive
    questions.
-   `answer_question(id, action, value?)`: Submits answer to unblock
    installer.
-   `get_logs(log_type?, lines?)`: Queries `journalctl` directly.
    Scopes: `installer` (`agama*`), `system`, `zypp`, or specific unit
    (e.g. `NetworkManager.service`). Default 100 lines (max 1000).

------------------------------------------------------------------------

## 4. Security Model & Token Isolation

### Threat: Boundary Bypass via Agent Introspection

AI agents with terminal or curl access can read their own client
configuration (`settings.json`). If the MCP token could access the REST
API (`/api`), the agent could use `curl` to call `/api/install` or
`/api/config`, bypassing MCP guardrails and `inst.mcp=config` mode.

### Solution: Cryptographic Token Isolation

-   `/mcp` validates requests strictly against a dedicated `mcp_token`
    using constant-time comparison via OpenSSL (`openssl::memcmp::eq`).
-   `/api/...` validates strictly against `jwt_secret`. Any attempt to
    use the MCP token against `/api/...` is rejected with
    `401 Unauthorized`.
-   No HTTP endpoint exposes the MCP token. Provisioning is strictly
    out-of-band:
    -   **PXE / Kernel Cmdline:** `inst.mcp.token=<SECRET>`
    -   **Local Host File:** `/run/agama/mcp-token` (`0400` permissions,
        root-only).

------------------------------------------------------------------------

## 5. Client Configuration

Client connects over HTTPS passing the dedicated token:

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

------------------------------------------------------------------------

## 6. UX Fallback

Agama's Web UI remains active concurrently. Operators can inspect the
AI-generated state, adjust it, or trigger installation manually if the
AI fails or `inst.mcp=config` is enforced.
