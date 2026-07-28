# 99hcn - Hybrid Cloud Network Dracut Module

Automatically configures bonded network interfaces for IBM PowerVM Hybrid Cloud Network (HCN) during initramfs boot.

## Quick Start

Add to kernel command line:

```bash
rd.hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0
```

This automatically discovers HCN devices via `/proc/device-tree`, creates an active-backup bond with the SR-IOV primary and vNIC backup adapters, and configures the specified IP address.

## What is HCN?

Hybrid Cloud Network (HCN) on IBM PowerVM provides high-availability networking by bonding two types of network adapters:

- **Primary adapter**: PCI SR-IOV Ethernet (high performance, direct hardware access)
- **Backup adapter**: Virtual NIC (vNIC) through hypervisor (reliability fallback during Live Partition Migration)

The bond operates in `active-backup` mode with `fail_over_mac=2`, allowing seamless failover during hardware events or Live Partition Migration (LPM).

## Kernel Parameters

### `rd.hcn.ip=<config>`

Configures IP addressing on HCN bond interfaces. The module transforms these parameters into standard `ip=` parameters, automatically replacing port interface names or MAC addresses with the corresponding bond controller names.

**How Interface Selection Works:**

- **Single HCN bond**: When no interface name or MAC address is specified, the configuration applies to the first (only) bond discovered
- **Multiple HCN bonds**: Use the **port interface name** or **port MAC address** to target a specific bond. The module automatically transforms the port reference to the bond controller name (e.g., `bond333e80f5`)

**Format Options:**

```bash
# Simple method (applies to first bond)
rd.hcn.ip={dhcp|auto6|dhcp6}

# Static IP (applies to first bond)
rd.hcn.ip=<client-IP>::<gateway>:<netmask>:::<method>

# Target specific bond by port interface name
rd.hcn.ip=<port-iface>:{dhcp|auto6}
rd.hcn.ip=<client-IP>::<gateway>:<netmask>::<port-iface>:<method>

# Target specific bond by port MAC address
rd.hcn.ip=<client-IP>::<gateway>:<netmask>::<port-MAC>:<method>
```

**Examples:**

```bash
# DHCP on first bond
rd.hcn.ip=dhcp

# IPv6 autoconfiguration on first bond
rd.hcn.ip=auto6

# Static IP on first bond
rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0:::none

# DHCP on bond containing enP32775p1s0 (port is transformed to bond controller)
rd.hcn.ip=enP32775p1s0:dhcp

# Static IP on bond containing env6 (port is transformed to bond controller)
rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0::env6:none
```

**How the transformation works:** The module discovers HCN devices and their bond mappings (port → bond controller), then rewrites `rd.hcn.ip` parameters by replacing port references with bond names before passing them to NetworkManager's initrd generator.

### `rd.hcn.route=<config>`

Adds static routes for HCN bond interfaces. Like `rd.hcn.ip`, this parameter supports port interface names or MAC addresses for targeting specific bonds in multi-bond configurations.

**Format Options:**

```bash
# Route on first bond (no interface specified)
rd.hcn.route=<network>/<prefix>:<gateway>

# Route on specific bond by port interface name
rd.hcn.route=<network>/<prefix>:<gateway>:<port-iface>

# Route on specific bond by port MAC address
rd.hcn.route=<network>/<prefix>:<gateway>:<port-MAC>
```

**Examples:**

```bash
# Single static route on first bond
rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0 \
  rd.hcn.route=10.0.0.0/8:192.168.1.1

# Multiple static routes on first bond
rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0 \
  rd.hcn.route=10.0.0.0/8:192.168.1.1 \
  rd.hcn.route=172.16.0.0/12:192.168.1.254

# Routes on specific bonds (multi-bond setup)
rd.hcn.ip=enP32775p1s0:dhcp \
  rd.hcn.ip=192.168.1.10::192.168.1.1:255.255.255.0::env6:none \
  rd.hcn.route=10.0.0.0/8:192.168.1.1:env6 \
  rd.hcn.route=172.16.0.0/12:192.168.1.254:env6
```

### `rd.hcn=1|0`

Explicitly enables or disables HCN configuration.

**Note:** This parameter is **optional and redundant** when `rd.hcn.ip` or `rd.hcn.route` is present, as these parameters automatically trigger HCN activation. Use `rd.hcn=0` to explicitly disable HCN even when other HCN parameters are present.

### `ip=hcn` (internal, do not use)

**This is not a user-facing parameter.** The module writes it itself to `/etc/cmdline.d/hcn.conf` to announce that HCN takes care of the network, see [Interaction with other modules](#interaction-with-other-modules). Use `rd.hcn.ip` / `rd.hcn.route` to configure HCN.

Passing `ip=hcn` on the kernel command line does **not** enable HCN, it only stops everybody else from configuring the network, so the system likely ends up with no network at all. Making it a proper user-facing option is part of the long-term transparent `ip=` work, where the port name or MAC would be given as usual (`ip=<port>:hcn`) and `rd.hcn.*` would be deprecated.

## Multiple HCN Bonds

When your system has multiple HCN bonds (multiple pairs of devices with different `ibm,hcn-id` values), you **must** target specific bonds using either:

1. **Port interface name** (e.g., `enP32775p1s0`, `env6`) - predictable network names known in advance from firmware/hypervisor configuration
2. **Port MAC address** (e.g., `2e:7a:3c:6a:1c:00`) - the logical port MAC address assigned to the port device

The module transforms these port identifiers to the actual bond controller names (e.g., `bond333e80f5`) before generating NetworkManager connections.

**Why port identifiers?** The bond controller name itself is derived from the HCN ID discovered at boot time from `/proc/device-tree`, which is not known in advance. However, the port interface names and MAC addresses are assigned by the hypervisor and are stable across reboots.

**Examples:**

```bash
# Two bonds targeted by port interface names
rd.hcn.ip=enP32775p1s0:dhcp \
  rd.hcn.ip=10.2.2.100::10.2.0.1:255.255.255.0::env6:none

# Two bonds targeted by port MAC addresses
rd.hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0::2e:7a:3c:6a:1c:00:none \
  rd.hcn.ip=10.2.2.100::10.2.0.1:255.255.255.0::2e:7a:3c:6a:1c:01:none

# With dashes in MAC address (also supported)
rd.hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0::2e-7a-3c-6a-1c-00:none \
  rd.hcn.ip=10.2.2.100::10.2.0.1:255.255.255.0::2e-7a-3c-6a-1c-01:none
```

**How it works:**

1. Module discovers that `enP32775p1s0` (SR-IOV) belongs to bond `bond333e80f5`
2. Module discovers that `env6` (vNIC) belongs to bond `bond444f91a6`
3. `rd.hcn.ip=enP32775p1s0:dhcp` is transformed to `ip=bond333e80f5:dhcp`
4. `rd.hcn.ip=10.2.2.100::10.2.0.1:255.255.255.0::env6:none` is transformed to `ip=10.2.2.100::10.2.0.1:255.255.255.0::bond444f91a6:none`
5. NetworkManager creates connections using the bond controller names

## How It Works

The HCN dracut module integrates with systemd and NetworkManager during the initramfs boot phase:

0. **Claiming the network**: A `cmdline` hook (`hcn-cmdline.sh`) writes `ip=hcn` to `/etc/cmdline.d/hcn.conf` when HCN is requested and HCN devices are present. This marker tells NetworkManager and the other Agama dracut modules that HCN configures the network, so nobody else touches the bond ports (see [Interaction with other modules](#interaction-with-other-modules))
1. **Device Discovery**: Scans `/proc/device-tree` for devices with matching `ibm,hcn-id` properties, building a mapping of port devices to bond controllers
2. **Parameter Transformation**: Replaces port interface names or MAC addresses in `rd.hcn.*` parameters with discovered bond controller names
3. **Bond Configuration**: Generates `bond=` parameters for active-backup bonds with the discovered primary (SR-IOV) and backup (vNIC) adapters
4. **Profile Generation**: Calls `nm-initrd-generator` with transformed `ip=`, `rd.route=`, and `bond=` parameters to create NetworkManager connection profiles
5. **Profile Adaptation**: Fixes up generated profiles for compatibility with the `hcnmgr` daemon (bond naming, controller references, UUIDs)
6. **Persistence**: Copies adapted profiles to `/etc/NetworkManager/system-connections/` for initramfs persistence
7. **System Persistence**: The Agama installer copies profiles to the installed system where `hcnmgr` manages them at runtime

**Key Design Points:**

- **Two-stage persistence**: Profiles are stored in `/etc/NetworkManager/system-connections/` during initramfs, then copied to the installed system by Agama's `save-agama-conf.sh`
- **Isolated generation**: Uses a custom output directory (`/run/hcn/system-connections/`) to prevent conflicts with standard NetworkManager profiles
- **No cmdline pollution**: The transformed parameters are passed directly to `nm-initrd-generator` as arguments and are never written to `/etc/cmdline.d/`. The only thing written there is the `ip=hcn` marker, which nothing but HCN acts upon

## Interaction with other modules

HCN cannot be configured from a `cmdline` hook: the bond ports only show up once udev has
discovered the devices, which happens long after the command line is parsed. Everything
else, though, is decided at that point, so the module reserves the network for itself as
early as possible by writing `ip=hcn` to `/etc/cmdline.d/hcn.conf`:

- **NetworkManager** skips the argument and, more importantly, does not fabricate its
  default DHCP connection when `rd.neednet=1` was requested but the command line produced
  no connection. That default would bring the bond ports up on their own, breaking the
  bond.
- **The other Agama modules** (`99agama-dud`, `99live-self-update`, `99initrd-nmtui`) only
  add `ip=dhcp` when the user did not configure the network. An `ip=` of any kind is
  enough for them to keep their hands off, hence the hook runs at priority 20, before
  their priority 99 hooks.

When HCN is requested but the device tree contains no HCN device, the marker is *not*
written: `parse-hcn` would not configure anything either, so the other modules should
keep providing their usual DHCP fallback.

The marker is an implementation detail between the module and NetworkManager. It is not
meant to be typed by users: `hcn-init-initrd.service` does not react to it, so an `ip=hcn`
given on the kernel command line configures nothing while still keeping the other modules
away from the network.

## Requirements

- IBM PowerVM system with HCN-capable adapters (devices with `ibm,hcn-id` properties in `/proc/device-tree`)
- NetworkManager with `nm-initrd-generator` support, including `ip=hcn` (jsc#PED-14534). Older versions treat `hcn` as an unknown method and generate their own wired DHCP connection, which breaks the bond
- Agama installer (for profile persistence to installed system)
- Supported platforms: SLES 16.1+ (NetworkManager < 1.54), Tumbleweed (NetworkManager >= 1.54)

## Files

- `module-setup.sh` - Dracut module installation and dependency declarations
- `hcn-cmdline.sh` - Dracut `cmdline` hook writing the `ip=hcn` marker
- `parse-hcn.sh` - Device discovery, bond configuration, and profile generation logic (despite the name, not a `cmdline` hook: it runs from the service below)
- `hcn-init-initrd.service` - Systemd service orchestrating boot-time HCN setup

## Documentation

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation, including:

- Boot-time integration and component diagram
- Sequential boot process flow
- HCN-specific parameter design rationale
- Two-stage persistence architecture
- Profile fixup and compatibility details

## Related Components

- **`hcnmgr` daemon**: Runtime management of HCN bonds in the installed system
- **Agama installer**: Copies initramfs network profiles to installed system via `save-agama-conf.sh`
- **dracut `nm-initrd-generator`**: Generates NetworkManager connection profiles from kernel parameters
- **NetworkManager**: Activates network connections during initramfs and runtime

## References

- [dracut-ng documentation](https://dracut-ng.github.io/)
- [NetworkManager nm-initrd-generator](https://networkmanager.dev/docs/api/latest/nm-initrd-generator.html)
- IBM PowerVM documentation: HCN configuration and Live Partition Migration
