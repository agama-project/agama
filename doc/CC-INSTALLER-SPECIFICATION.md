# Specification: CC/FIPS Hardened Agama Installation Script

## 1. Overview

The `cc-setup.sh` script is an interactive setup wrapper for Agama, designed for Common Criteria
(CC) compliant and FIPS hardened SUSE Linux Enterprise Server (SLES) installations. It securely
gathers system configurations, credentials, and disk targets, injects them into an Agama JSON
profile template, and starts the unattended installation via the Agama CLI and local REST API.

## 2. High-Level Requirements & Goals

- **Interactive Configuration:** Guide the user through a series of prompts to collect necessary
  system parameters.
- **Security & Hardening:** Ensure that sensitive information (passwords, encryption keys) is
  handled securely in memory, never logged, and explicitly scrubbed from disk. Validation of
  password will be handled by external script provided by the security team.
- **Profile Generation:** Generate a valid Agama auto-installation profile merging user inputs with
  a predefined JSON template (`agama-template.json`). We do not need to ask every detail, some
  default might set form the template.
- **Safety & Verification:** Present multiple verification gates (Configuration Summary and Storage
  Proposal) before making any destructive changes to the system.
- **Resilience:** Gracefully handle API communication errors, network delays during installation,
  and missing terminal capabilities (fallback line interface).

## 3. Pre-requisites and Dependencies

The system running the script must provide:

- **Core Utilities:** `bash`, `jq`, `curl`, `lsblk`.
- **UI Utilities:** `dialog` (optional, falls back to a plain text interface if missing or if a dumb
  terminal is detected), `less` (optional pager) 
- **Agama Environment:** The `agama` CLI, local Agama REST API running on `localhost`, and a valid
  authentication token.
- **Template:** A valid base Agama JSON profile template.

## 4. Execution Modes & Command Line Interface

The script accepts the following arguments:

- `--dialog`: Forces the `dialog`-based Text User Interface (TUI).
- `--plain` or `--text`: Forces the fallback line-based plain text interface (useful for serial consoles).
- `--template FILE`: Overrides the path to the Agama JSON template.
- `--dry-run`: Validates inputs and generates the profile but does not load it into Agama or perform
  any disk modifications. Used for testing or development purposes only, not available for
  end-users.
- `--help`: Displays usage instructions. (Mostly for compatibility, not used by users.)

## 5. Security & Environment Constraints

To protect secrets and ensure reliable execution:

- The script restricts permissions using `umask 077` and disables core dumps (`ulimit -c 0`).
- Bash history is disabled.
- The locale is forced to `C.UTF-8` to ensure consistent input handling (especially for passwords).
- A secure temporary directory (`/dev/shm`, `/run`, or `/tmp` using `mktemp -d`) is created to hold
  intermediate state files (like API configuration or `jq` variables). This directory and its
  contents are securely wiped using `shred` and deleted on script exit.

## 6. Interactive Workflow & State Machine

The script operates in a sequential flow with retry capabilities and distinct verification gates.

### 6.1. Initialization & Pre-checks

1. Evaluates system UI capabilities (TUI vs. line interface).
2. Verifies dependency presence.
3. Checks if system registration is mandatory (e.g., if a local package repository is missing and no
   RMT URL is provided via the boot command line).

### 6.2. Configuration Collection

The user is prompted sequentially for the following inputs:

- ~~**Keyboard Layout:** Fetched dynamically via Agama API. The layout is applied to the installer
  environment in real-time to ensure passwords are typed correctly.~~
  
  *Dropped, we do not configure the Grub keyboard so the English layout is used at boot which might
  prevent from writing the correct password.*
- **EULA Acceptance:** Displays the software license. If rejected, the machine forces a reboot.
- **Target Disk:** Selects the installation disk. If only one valid disk exists, it is auto-selected.
- Collect system credentials: **Root Password:**, **First User:** (username, full name, and
  password), **LUKS2 Passphrase:** Each password must be entered twice and is validated using a tool
  provided by the security team.
- **NTP Server:** If not pre-configured via boot command line (`dracut`), prompts for an NTP server
  (validated).
- **Registration details:** Collects SCC registration code and email (depending on the medium type
  registration is mandatory (Online medium) or optional (Full medium)).

### 6.3. Review Gates

1. **Configuration Summary:** Displays all gathered inputs (passwords masked). The user can choose
   to load the configuration, re-configure from scratch, or reboot.
2. **Storage Proposal:** After loading the generated profile into Agama, the script fetches the
   planned partition layout and storage actions from the Agama API. It clearly warns about data
   destruction and requires explicit confirmation to proceed.

User must always confirm rebooting the system.

### 6.4. Profile Generation (`jq` integration)

The inputs are merged into the base JSON template. Sensitive inputs (passwords) are passed to `jq`
securely via `--rawfile` (reading from the secure temporary directory) rather than command-line
arguments to avoid leaking them in the process table. The generated profile configures:

- Root and user accounts with hashed passwords.
- ~~Keyboard layout.~~ *Dropped*
- NTP server.
- Registration settings.
- Target disk search parameter and LUKS2 encryption passphrase.
- Injected files (e.g., NTP chrony config).

### 6.5. Installation & Monitoring

- **Trigger:** Invokes `agama install` to begin the process.
- **Monitor:** Spawns an asynchronous `agama monitor` process to render progress in the terminal.
- **API Polling:** Continually polls the Agama REST API (`/api/manager/installer`) to check the
  installation phase (whether installation finished).
- **Timeout Handling:** If the installation runs for an extended period, the script prompts the user
  to either keep waiting or abort (to prevent from termination on slow networks).
- **Completion:** Upon successful finish (phase 3 reported by API), the monitor is stopped, and the
  user is prompted to reboot.

## 7. Error Handling & Recovery

- Critical errors (e.g., missing dependencies, API failures, JSON templating errors) trigger a fatal
  error handler.
- The fatal handler gives the user the choice to restart the configuration, drop to a root shell for
  debugging, or reboot the machine.

## 8. Integration Points

- **Agama CLI:** Used to load profiles (`agama config load`), trigger installation (`agama
  install`), and monitor progress (`agama monitor`).
- **Agama REST API:** ~~Used to retrieve keyboard layouts,~~ fetch computed storage actions based on
  the profile, and monitor installation status.
- **Boot Command Line (`/run/agama/cmdline.d/agama.conf`):** Read to check for pre-defined RMT
  registration servers (`inst.register_url`).
