# Technical Design Specification: Agama MCP Server

**Author:** jreidinger
**Status:** RFC / Draft v1.0
**Context:** Project AIRI (AI-Orchestrated OS Provisioning) - Sub-Project 2

---

## 1. Executive Summary
This document outlines the technical design for embedding a Model Context Protocol (MCP) Server directly into the Agama installer live environment.

By treating the operating system installer as a stateful, queryable API rather than a static binary, we enable AI tools to dynamically probe hardware, construct configurations, validate proposals, and execute bare-metal installations in real-time. This changes the provisioning approach from static configuration files to dynamic, goal-oriented automation.

## 2. Architectural Principles & Constraints
* **Native Integration via Existing HTTP Layer:** Rather than deploying a separate sidecar process, the MCP Server is built directly into Agama's existing HTTP web server (which already handles the Web UI and WebSocket connections). The MCP Server-Sent Events (SSE) transport is exposed securely under a dedicated route (e.g., `/mcp`).
* **Direct Internal API Access:** By running within the Agama core process, the MCP endpoints interface directly with Agama's internal state machines and validation engines. This avoids the overhead of secondary inter-process communication (IPC) or D-Bus hops. Agama's internal engine remains the absolute source of truth for all validations.
* **Network Transport:** Standard MCP often defaults to `stdio` for local agent execution. Because the AI tool runs remotely (e.g., on Uyuni or a standalone chat interface), using the native HTTP server allows us to support the MCP SSE transport without opening additional ports.
* **Fail-Fast Validation:** AI tools can hallucinate. The API contract ensures that the AI cannot force an invalid installation.

## 3. Topology & Bootstrapping

The MCP endpoint is **disabled by default** to keep standard ISO installations secure and minimize the attack surface. It is only activated during an AI-driven deployment.

1. **Boot Injection:** To activate the MCP endpoint, the central manager (or human operator) injects specific parameters into the PXE boot configuration or bootloader.
2. **Kernel Cmdline:** The MCP server is enabled via a simple flag, while security uses Agama's standard live password mechanism:
   `inst.mcp=full live.password_hash=<PRE_COMPUTED_HASH>`
3. **Agama Server Initialization:** During the standard boot process, the Agama daemon parses `/proc/cmdline`. If the `inst.mcp=full` or `inst.mcp=readonly` flag is present, Agama's embedded HTTPS server mounts the `/mcp` route alongside its standard API. It binds this route to Agama's existing authentication middleware, requiring the AI to authenticate using the live session credentials.

## 4. API Contract & The State Machine
The Agama installer operates a strict one-way state machine. The MCP tools exposed to the AI tool enforce this state machine.

### Phase 1: System Inventory & Inspection (Read-Only)
*   **Tool:** `get_system()`
*   **Action:** Queries Agama's hardware probe engines (storage, network, hardware, software) to map the physical state of the machine.
*   **Output:** A structured JSON representation of the system's hardware inventory. The AI uses this data to base its configuration generation on reality (e.g., mapping logical volumes to actual physical NVMe paths).

### Phase 2: Configuration & Validation (Idempotent / Trial)
*   **Tool:** `set_config(config)`
*   **Action:** Pushes the AI-generated Agama profile (JSON) to the installer. *Note for implementers: This endpoint performs a full replacement of the configuration state. The AI must supply the complete, desired JSON structure on every call.*
*   **Error Handling:** If the AI generates invalid JSON or violates the Agama schema, the MCP server immediately throws a standard JSON-RPC `-32602 (Invalid params)` error, returning Agama's exact schema validation output so the AI can correct it.

### Phase 3: Proposal Verification & Logical Validation (Crucial Guardrail)
*   **Tool:** `get_proposal()`
*   **Action:** Commands Agama to compute the final installation plan based on the injected configuration and hardware reality.
*   **Output (Computing):** If solvers (storage partitioning, package dependency resolution) are actively computing, returns `{"status": "proposal_computing", "active_tasks": [...]}` so the orchestrator knows to wait.
*   **Output (Success):** Returns a diff/plan of what will actually happen (e.g., "Drive /dev/sda will be wiped, 3 partitions created, SLES 16 Base installed").
*   **Output (Failure):** If `set_config` succeeds (the JSON schema is valid), but the configuration is logically impossible to apply (e.g., requesting a partition larger than the physical disk, selecting unavailable software patterns, or missing mandatory authentication settings), `get_proposal()` returns these asynchronous logical errors. The AI must parse these errors and issue a new `set_config` to resolve them.
*   **Note:** This is the most critical phase. The AI evaluates a successful proposal against the human operator's original request. It halts and asks for Human-in-the-Loop (HITL) approval via the central manager (or chat UI) before proceeding.

### Phase 4: Execution & Observability
*   **Tool:** `commit_install()`
*   **Action:** Locks the state machine and triggers the disk format and software deployment. Once triggered, the orchestrator relies on `get_progress()` to monitor completion. 
    *   **On Success:** Upon reaching 100%, Agama initiates a system reboot, terminating the MCP session.
    *   **On Failure:** The system does *not* reboot. The MCP session remains active so the AI tool can query `get_logs()` to diagnose the failure. *Crucially, Agama's state machine is strictly one-way; if the active installation fails, the MCP server cannot "reset" or restart the installation with a new profile. The bare-metal node must be physically rebooted to start a fresh PXE session.*
*   **Tool:** `get_progress()`
*   **Action:** Returns structured data regarding current state, stage, percentage completion, active tasks, and pending questions (`hasPendingQuestions: bool`, `pendingQuestions: [...]`).
*   **Tool:** `get_questions()`
*   **Action:** Retrieves interactive questions raised by installer services that currently await an answer (e.g., LUKS disk decryption password, GPG import, package installation retry).
*   **Tool:** `answer_question(id: integer, action: string, value: string)`
*   **Action:** Submits an answer to a pending question by ID, choosing an action from the question's available actions list and providing an optional value (e.g. password), unblocking the installer.
*   **Tool:** `get_logs(log_type: string, lines: integer)`
*   **Action:** Retrieves specific subsets of system logs directly from `journalctl` without relying on static log file paths, preventing overwhelming the AI's context window. `log_type` allows the AI to request specific scopes:
    *   `installer` (default): Agama installer service traces (`journalctl -u 'agama*'`).
    *   `system`: Full system journal (`journalctl`).
    *   `zypp` (or `software`): Package management and libzypp entries (`journalctl -u 'agama*' -g 'zypp'`).
    *   Custom unit name (e.g., `sshd.service`, `NetworkManager.service`): Queries that specific systemd unit (`journalctl -u <unit>`).
    The `lines` parameter (defaulting to the last 100 lines, max 1000) ensures the AI retrieves only the most recent stack trace or error output, preventing massive logs from blowing out token limits during diagnosis.

## 5. Security Model (Native Alignment)
Because the MCP endpoint is natively embedded within Agama's HTTP server, it inherits Agama's standard security model rather than requiring a custom authentication layer.

*   **Native Authentication:** The `/mcp` route does not invent a new authentication mechanism. It sits securely behind Agama's built-in session authentication. Before connecting to the MCP Server-Sent Events (SSE) stream, the AI tool must first authenticate against Agama's standard `/login` REST endpoint using the live environment's credentials (configured via `live.password_hash`). This `/login` call returns a standard HTTP Bearer token, which the agent then passes in the `Authorization` header to establish the `/mcp` connection.
*   **Encrypted Transport (HTTPS):** Agama natively serves its web interface and API over HTTPS using a self-signed certificate (or a custom injected cert). All MCP Server-Sent Events (SSE) and JSON-RPC payloads are encrypted in transit. The AI tool must be configured to trust the certificate or temporarily bypass strict SSL verification during the initial setup phase.
*   **mDNS & Discovery:** Like the web UI, the MCP endpoint is accessible via the network. By relying on Agama's native network stack, we ensure the central manager can securely connect to `https://<ip_or_hostname>/mcp` without breaking standard Agama networking rules or requiring complex VLAN bindings.
*   **Opt-In Surface Area:** The MCP endpoint remains strictly disabled unless an `inst.mcp` parameter (e.g., `full` or `readonly`) is explicitly passed, ensuring standard ISO installations are not exposed to automated programmatic control by default.

## 6. UX Fallbacks & Read-Only Mode
A critical requirement for introducing AI into bare-metal provisioning is maintaining human control. The human operator must always retain ultimate authority over the installation process.

*   **Simultaneous UI Access:** Because the MCP endpoint runs natively alongside Agama's existing web server, the standard Agama Web UI remains fully active. If the AI hallucinates, fails to diagnose an error, or the operator has doubts about the AI's proposal, the operator can open the Agama Web UI in their browser, inspect the exact state the AI left behind, modify it, and manually proceed.
*   **Strict Read-Only Mode:** To satisfy stringent security policies, the MCP server can be bootstrapped in a strict read-only mode via the kernel command line: `inst.mcp=readonly`. 
    *   In this mode, the AI tool is authorized to use `get_system()`, `set_config()`, and `get_proposal()` to construct and validate the profile.
    *   However, the `commit_install()` tool is completely disabled (returning a `403 Forbidden` JSON-RPC error). 
    *   This forces a hard physical-plane approval: the AI computes the perfect configuration, but a human *must* log into the Agama Web UI to physically click the "Install" button.

## 7. Client Configuration & Connectivity
To connect an external AI client (e.g., Gemini CLI, Cursor, or Claude Desktop) to the Agama MCP server, the client must be configured to use the **HTTP (or SSE)** transport rather than the standard local `stdio` transport.

1.  **Authentication Handshake:**
    The central manager or the human operator must first obtain the Bearer token. This is done via a standard REST call to Agama before initializing the MCP client:
    ```bash
    curl -k -X POST https://<agama-ip>/login \
         -H "Content-Type: application/json" \
         -d '{"password": "<live_password>"}'
    # Returns: {"token": "eyJhbGciOiJIUzI1NiIn..."}
    ```
2.  **Client Configuration (Example):**
    Once the token is retrieved, the AI client is configured to connect to the `/mcp` (or `/sse`) endpoint, passing the token in the headers.

    *Example (`mcp.json` / Cursor / Continue.dev configuration):*
    ```json
    {
      "mcpServers": {
        "agama-baremetal": {
          "url": "https://<agama-ip>/mcp",
          "requestOptions": {
            "headers": {
              "Authorization": "Bearer eyJhbGciOiJIUzI1NiIn..."
            }
          }
        }
      }
    }
    ```
    *(Note: If the client only supports `stdio` natively, a local bridge proxy like `mcp-remote` can be used to translate the local execution into the remote authenticated HTTP request).*

## 8. Known Trade-offs & Open Questions
1.  **Shared HTTP Lifecycle:** By embedding the MCP endpoint into Agama's existing web server, we eliminate the need for a separate sidecar. However, this tightly couples the AI orchestration layer to the lifecycle and performance of the Agama UI server. *Decision: The simplicity of sharing the HTTP port and internal API bindings heavily outweighs the theoretical risks of shared resource contention.*
2.  **LLM Context Windows:** A full Agama hardware inventory JSON can be massive (especially on systems with 100+ disks or complex NUMA nodes). *Mitigation Strategy:* The `get_system()` tool must accept filter parameters (e.g., `get_system(resource="storage")`) to prevent blowing out the AI tool's context window.