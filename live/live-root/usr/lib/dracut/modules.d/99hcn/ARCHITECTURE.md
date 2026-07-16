# HCN Dracut Module Architecture

This document provides the technical design and architecture for the 99hcn dracut module, explaining how it integrates with systemd, NetworkManager, and the Agama installer to provide automatic HCN network configuration during boot.

## Table of Contents

1. [Overview](#overview)
2. [Key Architecture Principles](#key-architecture-principles)
3. [Boot-Time Integration & Component Diagram](#boot-time-integration--component-diagram)
4. [Sequential Boot Process](#sequential-boot-process)
5. [HCN-Specific Boot Parameters](#hcn-specific-boot-parameters)
6. [Parameter Transformation Flow](#parameter-transformation-flow)
7. [Profile Generation and Adaptation](#profile-generation-and-adaptation)
8. [Two-Stage Persistence Architecture](#two-stage-persistence-architecture)
9. [Future Considerations](#future-considerations)

## Overview

The 99hcn dracut module provides automatic network configuration for IBM PowerVM Hybrid Cloud Network (HCN) during the initramfs phase of boot. It integrates with systemd and NetworkManager to discover HCN devices, create bonded interfaces, and generate NetworkManager connection profiles that persist to the installed system for runtime management by `hcnmgr`.

**Core Responsibilities:**

1. Parse HCN-specific kernel parameters (`rd.hcn.ip`, `rd.hcn.route`)
2. Discover HCN device pairs via `/proc/device-tree` properties
3. Transform HCN parameters into bond-targeted standard dracut parameters
4. Generate NetworkManager connection profiles via `nm-initrd-generator`
5. Adapt profiles for `hcnmgr` daemon compatibility
6. Persist profiles across initramfs and into the installed system

## Key Architecture Principles

1. **Systemd Conditional Activation**: The `hcn-init-initrd.service` uses systemd `ConditionKernelCommandLine` directives to activate only when:
   - `rd.hcn=1` is present, OR
   - `rd.hcn.ip` is present, OR
   - `rd.hcn.route` is present
   - AND `rd.hcn=0` is NOT present (explicit disable)

2. **Two-Stage Persistence**:
   - **Stage 1 (HCN module)**: Generates and fixes up connections in `/run/hcn/system-connections/`, then copies them to `/etc/NetworkManager/system-connections/` for initramfs persistence.
   - **Stage 2 (Agama module)**: Before pivoting to the installed system, `save-agama-conf.sh` copies connections from `/etc/NetworkManager/system-connections/` (with `origin=nm-initrd-generator`) to the target system's `/etc/NetworkManager/system-connections/`.

3. **Isolated Profile Generation**: Uses a custom output directory (`/run/hcn/system-connections/`) instead of the standard `/run/NetworkManager/system-connections/` to prevent conflicts during profile generation and adaptation.

4. **No Cmdline Pollution**: Transformed parameters are passed directly to `nm-initrd-generator` as command-line arguments, never written to `/etc/cmdline.d/`, preventing other dracut modules from reading them and regenerating incompatible profiles.

5. **Timing-Aware Orchestration**: Two-phase execution (cmdline hook + systemd service) handles the fact that HCN devices may not be available when kernel command line parsing runs.

## Boot-Time Integration & Component Diagram

The following diagram details the control and configuration flow from the initial kernel/logging and early cmdline phase down to NetworkManager activation. It showcases how the execution path adapts dynamically to both standard and HCN boots, highlighting differences between Tumbleweed (NetworkManager >= 1.54) and SLES 16.1 (NetworkManager < 1.54).

```text
                                HARDWARE / HYPERVISOR (PowerVM)
+-------------------------------------------------------------------------------------------------+
|                                                                                                 |
|   +---------------------------------------+           +-------------------------------------+   |
|   |          PCI SR-IOV Ethernet          |           |            Virtual NIC (vnic)       |   |
|   |  - Property: ibm,hcn-id = <hcn-id>    |           |   - Property: ibm,hcn-id = <hcn-id> |   |
|   |  - Property: ibm,hcn-mode = "primary" |           |   - Property: ibm,hcn-mode = "backup"|  |
|   |  - local-mac-address = <MAC_A>        |           |   - local-mac-address = <MAC_B>     |   |
|   +-------------------+-------------------+           +------------------+------------------+   |
+-----------------------|--------------------------------------------------|----------------------+
                        |                                                  |
                        v                                                  v
             /proc/device-tree/pci*/ethernet*                    /proc/device-tree/vdevice/vnic*
                        |                                                  |
===================================================================================================
                                           INITRD PHASE
===================================================================================================
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|  1. EARLY CMDLINE & LOGGING PHASE (`dracut-cmdline.service`)                                    |
|     - Runs early cmdline hook: `/lib/dracut/hooks/cmdline/99-nm-config.sh`                      |
|     - Standard NetworkManager connection generation proceeds normally.                          |
|                                                                                                 |
|     SLES 16.1 (NM < 1.54):                                                                      |
|     - `nm-config.sh` executes `nm_generate_connections` normally.                               |
|                                                                                                 |
|     Tumbleweed (NM >= 1.54):                                                                    |
|     - No generation in cmdline hook (delegated to systemd service).                             |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|  1.5 NETWORK GENERATION SERVICE PHASE (Tumbleweed Only)                                         |
|     Runs `NetworkManager-config-initrd.service` (Before `systemd-udevd.service`):               |
|     - RUNS standard `nm-initrd-generator` normally.                                             |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
+-------------------------------------------------------------------------------------------------+
|  2. KERNEL & UDEV DISCOVERY (`systemd-udev-trigger.service`)                                    |
|     - Drivers bind to physical/virtual devices.                                                 |
|     - Interfaces appear in sysfs: e.g. /sys/class/net/enP32775p1s0 and /sys/class/net/env6      |
+-----------------------------------------------+-------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------+-------------------------------------------------+
|  3. HCN BOND CONFIGURATION SERVICE PHASE                                                        |
|     `hcn-init-initrd.service` (Runs `/usr/bin/parse-hcn` after udev discovery):                |
|     - Activates when any of: rd.hcn=1, rd.hcn.ip, or rd.hcn.route is present                    |
|     - If none are present: Exits early (no-op).                                                 |
|     - If HCN is enabled:                                                                        |
|       * Discovers HCN devices from /proc/device-tree (PCI SR-IOV and VNIC adapters)            |
|       * Compiles bond mapping: `bond333e80f5 -> [enP32775p1s0, env6]` with modes and MACs      |
|       * Reads `rd.hcn.ip` and `rd.hcn.route` params and transforms them to bond-targeted        |
|         `bond=`, `ip=`, and `rd.route=` options.                                                |
|       * Calls `nm-initrd-generator` DIRECTLY with `-c /run/hcn/system-connections` (does NOT   |
|         write to `/etc/cmdline.d/` to prevent future regeneration).                             |
|       * Performs interface profile fixups for hcnmgr compatibility in `/run/hcn/system-         |
|         connections/` (bond naming, controller references, UUIDs, etc.).                        |
|       * Copies adapted profiles to `/etc/NetworkManager/system-connections/` for persistence.   |
+-----------------------------------------------+-------------------------------------------------+
                                                |
                                                v
+-----------------------------------------------+-------------------------------------------------+
|  4. NETWORK MANAGER ACTIVATION                                                                  |
|     - Brings up connection profiles (either standard or bond).                                  |
|                                                                                                 |
|     A. Tumbleweed (NM >= 1.54): `NetworkManager-initrd.service`                                 |
|     B. SLES 16.1 (NM < 1.54): `nm-initrd.service`                                               |
+-------------------------------------------------------------------------------------------------+
```

## Sequential Boot Process

1. **Kernel Initialization & Initramfs Mount**:
   The kernel mounts the initramfs. Systemd starts as PID 1 (`/usr/lib/systemd/systemd`).

2. **Early Cmdline & Discovery Phase (`dracut-cmdline.service`)**:
   - `dracut-cmdline` processes all command line hooks, including `/lib/dracut/hooks/cmdline/99-nm-config.sh`.
   - Standard NetworkManager connection generation proceeds normally:
     - **SLES 16.1 (NetworkManager < 1.54):** `99-nm-config.sh` calls `nm_generate_connections` to generate standard connection profiles.
     - **Tumbleweed (NetworkManager >= 1.54):** `99-nm-config.sh` does not call `nm_generate_connections` (which is delegated to a systemd service).

2.5. **Network Generation Service Phase (Tumbleweed with NetworkManager >= 1.54 Only)**:

- **`NetworkManager-config-initrd.service`** runs (ordered `Before=systemd-udevd.service` and `systemd-udev-trigger.service`).
- It runs standard `nm-initrd-generator` normally to generate connection profiles based on kernel arguments.

1. **Udev Device Discovery**:
   - `systemd-udevd.service` starts and triggers hardware udev events via `systemd-udev-trigger.service`.
   - Network interfaces (physical/virtual) are discovered and matching kernel drivers are loaded.
   - Network device nodes (e.g. `enP32775p1s0`, `env6`) are created under `/sys/class/net/`.

2. **Network Generator Orchestration**:
   - **`hcn-init-initrd.service`** starts (ordered `After=systemd-udev-trigger.service` and `Before=dracut-initqueue.service nm-initrd.service NetworkManager-initrd.service`). It activates when any of these kernel command line parameters are present: `rd.hcn=1`, `rd.hcn.ip`, or `rd.hcn.route`.
     - **If none of these parameters are present:** Service does not start (systemd conditions prevent execution).
     - **If any HCN parameter is present:**
       - `/usr/bin/parse-hcn` performs discovery in `/proc/device-tree` to pair adapters sharing an `ibm,hcn-id`.
       - For each device, it waits up to 3 minutes for the interface to appear after potential migration events.
       - It reads the HCN-specific kernel command line options `rd.hcn.ip` and `rd.hcn.route` and translates them to target the planned bond interface (e.g. `bond333e80f5`).
       - It calls the standard `nm-initrd-generator` **directly** with transformed parameters as command-line arguments and custom output directory `-c /run/hcn/system-connections`.
       - It adapts the generated NetworkManager profiles for compatibility with `hcnmgr` daemon (bond naming, controller references, UUIDs).
       - The adapted profiles are copied to `/etc/NetworkManager/system-connections/` for persistence across reboots.

3. **Network Interface Activation (NetworkManager)**:
   - The appropriate activation service starts:
     - **Tumbleweed (NetworkManager >= 1.54):** `NetworkManager-initrd.service` starts.
     - **SLES 16.1 (NetworkManager < 1.54):** `nm-initrd.service` starts.
   - It reads from `/etc/NetworkManager/system-connections/` (HCN connections) and `/run/NetworkManager/system-connections/` (standard connections).
   - **HCN Active Path:** Creates the bond interface, binds the port interfaces, and applies IP and routing configurations. Connection profiles are structured for `hcnmgr` compatibility.
   - **HCN Inactive / Fallback Path:** Configures and starts standard independent interfaces according to standard `ip=` and `rd.route=` parameters.

4. **Agama Module Integration (Before Pivot)**:
   - Before pivoting to the installed system, the `99agama-cmdline` module's `save-agama-conf.sh` script executes.
   - If `inst.copy_network` is enabled (default) and custom network configuration is detected:
     - Copies runtime connections from `/run/NetworkManager/system-connections/` with `origin=nm-initrd-generator` to the installed system.
     - **Copies persistent HCN connections** from `/etc/NetworkManager/system-connections/` with `origin=nm-initrd-generator` to the installed system.
     - This ensures HCN bond configurations persist into the installed system for `hcnmgr` daemon to manage.

## HCN-Specific Boot Parameters

### Why Not Transform Standard `ip=` Options?

The HCN dracut module introduces dedicated boot parameters `rd.hcn.ip` and `rd.hcn.route` instead of transforming standard `ip=` and `rd.route=` kernel command line options. This design decision addresses several critical architectural concerns:

1. **Kernel Command Line Immutability:**
   - `/proc/cmdline` is **read-only** and cannot be modified at runtime
   - We cannot append or transform parameters into `/proc/cmdline` after the kernel starts
   - Even if we could modify it, other dracut modules have already cached its contents during early boot

2. **Two-Phase Configuration Process:**
   - **Phase 1 (Boot-time):** The `parse-hcn.sh` script transforms `rd.hcn.ip` and `rd.hcn.route` parameters into a combination of `bond=`, `ip=`, and `rd.route=` options with the appropriate bond interface name (e.g., `bond333e80f5`).
   - **Phase 2 (Profile Adaptation):** The generated NetworkManager connection profiles must be adapted to ensure compatibility with the `hcnmgr` daemon, which manages bond interfaces dynamically during the installed system's lifecycle (e.g., during Live Partition Migration).
3. **Module Regeneration Risk:**
   If another dracut module or NetworkManager tool regenerates network configuration after the initial HCN setup, using standard `ip=` parameters would cause those tools to generate incompatible connection profiles that would lack proper bond configuration and break HCN functionality.

4. **Compatibility with `hcnmgr`:**
   The `hcnmgr` daemon expects specific bond naming conventions and connection structure:
   - Bond interfaces follow the `bondXXXXXXXX` naming pattern (where XXXXXXXX is derived from the HCN ID)
   - Connection profiles include proper controller/port relationships with correct naming
   - UUIDs and connection metadata are structured for `hcnmgr` runtime management
   - Bond options (mode, fail_over_mac, miimon, primary) are set according to HCN requirements

### Parameter Syntax

- **`rd.hcn.ip=<value>`**: Specifies IP configuration for the HCN bond interface. The syntax mirrors the standard `ip=` parameter but **omits the interface name** (since the bond name is derived from the HCN ID).

  Format: `rd.hcn.ip=<client-IP>::<gateway>:<netmask>:::<method>`

  Example: `rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0:::none`

- **`rd.hcn.route=<value>`**: Specifies routing configuration for the HCN bond interface. The syntax mirrors the standard `rd.route=` parameter but **omits the interface name**.

  Format: `rd.hcn.route=<network>/<prefix>:<gateway>`

  Example: `rd.hcn.route=192.168.1.0/24:192.168.1.1`

- **`rd.hcn=1`**: Explicitly enables HCN configuration. **Note:** This parameter is optional and redundant when `rd.hcn.ip` or `rd.hcn.route` is present.

**Important:** The interface name is intentionally omitted from both `rd.hcn.ip` and `rd.hcn.route` parameters because:

- The bond interface name is automatically derived from the HCN ID discovered in `/proc/device-tree`
- This ensures the bond name always matches `hcnmgr` expectations
- Prevents user error in specifying incorrect bond names

## Parameter Transformation Flow

### Complete Boot Command Line Example

**User provides (on kernel command line or in Grub configuration):**

```
rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0:::none rd.hcn.route=192.168.1.0/24:192.168.1.1
```

This configuration:

- Configures the HCN bond with static IP 192.168.1.10, gateway 192.168.1.1, and netmask 255.255.255.0
- Adds a route to the 192.168.1.0/24 network via 192.168.1.1
- **Note:** Interface name is intentionally omitted from `rd.hcn.ip` and `rd.hcn.route`

**The `parse-hcn.sh` script transforms this into (example for HCN ID `333e80f5`):**

Passed directly as arguments to `nm-initrd-generator`:

```bash
nm-initrd-generator -- \
  bond=bond333e80f5:enP32775p1s0,env6:mode=active-backup,fail_over_mac=2,miimon=100,primary=enP32775p1s0 \
  ip=192.168.1.10::192.168.1.1:255.255.255.0::bond333e80f5:none \
  rd.route=192.168.1.0/24:192.168.1.1:bond333e80f5
```

Where:

- `bond333e80f5` is derived from HCN ID `333e80f5` discovered in `/proc/device-tree`
- `enP32775p1s0` is the primary SR-IOV interface (discovered via `ibm,hcn-mode = "primary"`)
- `env6` is the backup virtual NIC interface (discovered via `ibm,hcn-mode = "backup"`)
- Both interfaces share the same `ibm,hcn-id = 333e80f5` property
- Bond options are hardcoded for HCN requirements:
  - `mode=active-backup`: Only one port is active at a time
  - `fail_over_mac=2`: Follow the selection of the active port
  - `miimon=100`: Monitor link status every 100ms
  - `primary=enP32775p1s0`: Prefer the SR-IOV interface as primary

**These transformed parameters are:**

1. Passed **directly** to `nm-initrd-generator` as command-line arguments (NOT written to `/etc/cmdline.d/`)
2. Output directed to isolated directory: `-c /run/hcn/system-connections`
3. Used by `nm-initrd-generator` to create initial NetworkManager connection profiles
4. Adapted by `fixup_nm_connections()` to ensure `hcnmgr` daemon compatibility
5. Copied to `/etc/NetworkManager/system-connections/` for persistence across reboots
6. Activated by NetworkManager which reads from `/etc/NetworkManager/system-connections/`

### Three-Layer Protection Strategy

The HCN module employs a comprehensive protection strategy to ensure `hcnmgr`-compatible profiles survive across boot stages and prevent regeneration by other modules:

1. **Layer 1 - Prevent Regeneration Trigger:**
   - Only the HCN module understands `rd.hcn.*` parameters
   - Transformed parameters are **never written to `/etc/cmdline.d/`**
   - Passed directly to `nm-initrd-generator` as command-line arguments only
   - Other modules have no transformed parameters to misinterpret

2. **Layer 2 - Isolated Generation:**
   - Uses custom output directory: `-c /run/hcn/system-connections`
   - Prevents conflicts with standard `/run/NetworkManager/system-connections/`
   - Allows safe adaptation before making profiles visible to NetworkManager

3. **Layer 3 - Persistent Storage:**
   - Copies adapted profiles to `/etc/NetworkManager/system-connections/`
   - Survives reboots (unlike `/run` which is tmpfs)
   - Protects against other modules that might `rm /run/NetworkManager/system-connections/*`
   - NetworkManager reads persistent profiles, ensuring HCN configuration survives

**Key Insight:** The dedicated parameters (`rd.hcn.ip`, `rd.hcn.route`) aren't just about syntax—they're about **protecting the two-phase transformation workflow** through isolated generation, persistent storage, and preventing regeneration triggers.

## Profile Generation and Adaptation

### High-Level Profile Structure

Generated NetworkManager profiles require modifications for `hcnmgr` compatibility:

**Bond Profile Adaptations:**

- Rename from `bond-bond<hcn-id>.nmconnection` to `bond<hcn-id>.nmconnection`
- Update connection ID to match filename
- Generate deterministic UUID based on bond name
- Ensure `origin=nm-initrd-generator` marker for persistence

**Port Profile Adaptations:**

- Update controller references to match new bond profile name
- Maintain proper controller/port relationships
- Preserve MAC address bindings

### Bond Configuration Structure

The bond interface is created with the following NetworkManager profile structure:

```ini
[connection]
id=bond333e80f5
uuid=<deterministic-uuid>
type=bond
interface-name=bond333e80f5
origin=nm-initrd-generator

[bond]
mode=active-backup
fail_over_mac=2
miimon=100
primary=enP32775p1s0

[ipv4]
method=manual
address1=192.168.1.10/24,192.168.1.1
route1=192.168.1.0/24,192.168.1.1
```

Port profiles reference this bond:

```ini
[connection]
id=bond333e80f5-enP32775p1s0
uuid=<generated-uuid>
type=ethernet
interface-name=enP32775p1s0
controller=bond333e80f5
port-type=bond
origin=nm-initrd-generator

[ethernet]
mac-address=<discovered-mac>
```

## Two-Stage Persistence Architecture

### Stage 1: Initramfs Persistence (HCN Module)

**Location:** `/etc/NetworkManager/system-connections/`

**Purpose:** Make profiles available to NetworkManager during initramfs and protect against module regeneration

**Flow:**

1. `parse-hcn.sh` generates profiles in `/run/hcn/system-connections/`
2. Profiles are adapted for `hcnmgr` compatibility (fixup process)
3. Adapted profiles are copied to `/etc/NetworkManager/system-connections/`
4. NetworkManager reads from `/etc/NetworkManager/system-connections/` and activates the bond

**Protection mechanisms:**

- `/etc` persists across dracut module execution (unlike `/run` which modules may clear)
- Other dracut modules don't know about `/run/hcn/system-connections/` (isolated generation)
- No transformed parameters in `/etc/cmdline.d/` prevents other modules from regenerating

### Stage 2: Installed System Persistence (Agama Module)

**Location:** Target system's `/etc/NetworkManager/system-connections/`

**Purpose:** Make HCN profiles available in the installed system for `hcnmgr` daemon

**Flow:**

1. Agama's `save-agama-conf.sh` runs before system pivot
2. Scans `/etc/NetworkManager/system-connections/` for profiles with `origin=nm-initrd-generator`
3. Copies matching profiles to installed system's `/etc/NetworkManager/system-connections/`
4. After boot into installed system, `hcnmgr` daemon manages the bond profiles

**Integration points:**

- `inst.copy_network` kernel parameter enables copying (default: enabled)
- `/run/agama/custom_dracut_network` marker file indicates custom network configuration
- Agama copies profiles with proper permissions and SELinux contexts

## Future Considerations

### Potential Enhancements

1. **IPv6 Support:**
   - IPv6 static addressing should work (same parameter format)
   - IPv6 autoconfiguration needs testing: `rd.hcn.ip=auto6`
   - Multiple IPv6 addresses per bond

2. **Configurable Bond Options:**
   - Currently hardcoded: `mode=active-backup fail_over_mac=2 miimon=100`
   - Could expose via `rd.hcn.bond_options=...`
   - Requires validation against `hcnmgr` expectations

3. **DNS Configuration:**
   - Current `ip=` format supports nameserver (8th field)
   - Example: `rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0:::none:8.8.8.8`
   - Needs testing and documentation

4. **VLAN Support:**
   - HCN bonds may carry VLAN-tagged traffic
   - Requires additional parameter: `rd.hcn.vlan=<vlan-id>`
   - Profile generation for VLAN interfaces on top of bond

5. **Configurable Timeout:**
   - Current 180-second timeout may be insufficient on slow hardware or during complex LPM
   - Consider: `rd.hcn.timeout=300`

### Known Limitations

1. **Timing Sensitivity:**
   - 180-second timeout may be insufficient in rare cases
   - No retry mechanism for transient device-tree reading errors

2. **Error Reporting:**
   - Failures may be silent if systemd journal is not checked
   - Consider using `dracut-emergency` for fatal errors
   - Could add visual indicators (Plymouth messages)

3. **Profile Compatibility:**
   - Assumes `hcnmgr` naming conventions remain stable
   - Breaking changes in `hcnmgr` may require profile fixup updates
   - No version detection or compatibility checking

4. **Single-Bond Assumption in Simple Cases:**
   - When no MAC address is specified, first discovered HCN ID is used
   - May be unexpected on multi-bond systems

### Maintenance Considerations

- **Dracut API Stability:** Module relies on dracut hook conventions (cmdline phase, systemd service ordering)
- **NetworkManager Compatibility:** Profile format changes between NetworkManager versions may require fixup updates
- **hcnmgr Evolution:** Monitor `hcnmgr` for changes to profile format expectations, bond naming, or UUID structure
- **Kernel Parameter Namespace:** `rd.hcn.*` namespace should be coordinated with upstream dracut to avoid conflicts

---

## References

- [dracut-ng documentation](https://dracut-ng.github.io/)
- [NetworkManager nm-initrd-generator](https://networkmanager.dev/docs/api/latest/nm-initrd-generator.html)
- IBM PowerVM HCN documentation
- `hcnmgr` source code and runtime bond management
