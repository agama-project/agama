#!/usr/bin/env bats
# Unit tests for hcn-cmdline.sh, the dracut cmdline hook writing the "ip=hcn"
# marker that tells NetworkManager and the other dracut modules that HCN takes
# care of the network configuration.

FIXTURE_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
HOOK_PATH="${FIXTURE_DIR}/../../live-root/usr/lib/dracut/modules.d/99hcn/hcn-cmdline.sh"

# Device tree with HCN devices (one PCI ethernet and one vnic)
HCN_DEVICE_TREE_FIXTURE="${FIXTURE_DIR}/proc/device-tree"

setup() {
    TEST_WORK_DIR="$(mktemp -d "${BATS_TEST_TMPDIR:-/tmp}/hcn-cmdline.XXXXXX")"
    export TEST_WORK_DIR

    # A device tree without any HCN device
    export EMPTY_DEVICE_TREE="$TEST_WORK_DIR/device-tree"
    mkdir -p "$EMPTY_DEVICE_TREE/pci@0/ethernet@0" "$EMPTY_DEVICE_TREE/vdevice"

    export HCN_CMDLINE_FILE="$TEST_WORK_DIR/20-hcn.conf"
    export HCN_DEVICE_TREE="$HCN_DEVICE_TREE_FIXTURE"
    export MOCK_CMDLINE=""
}

teardown() {
    [ -d "$TEST_WORK_DIR" ] && rm -rf "$TEST_WORK_DIR"
}

# Mock the dracut library functions used by the hook, backed by MOCK_CMDLINE
info() { echo "INFO: $*" >&2; }
warn() { echo "WARN: $*" >&2; }

getarg() {
    local arg
    for arg in $MOCK_CMDLINE; do
        case "$arg" in
        "${1%=}" | "${1%=}"=*)
            echo "${arg#*=}"
            return 0
            ;;
        esac
    done
    return 1
}

# Simplified getargbool: <default> <option>
getargbool() {
    local value
    value=$(getarg "$2=") || return "$(($1 == 1 ? 0 : 1))"
    case "$value" in
    "" | 1 | on | y | yes) return 0 ;;
    *) return 1 ;;
    esac
}

run_hook() {
    # shellcheck disable=SC1090
    run bash -c ". '$HOOK_PATH'"
}

# The hook only sources /lib/dracut-lib.sh when the functions are missing
export -f info warn getarg getargbool

# ========================================
# Test: the marker is written
# ========================================

@test "hcn-cmdline: writes ip=hcn when rd.hcn.ip is given" {
    export MOCK_CMDLINE="rd.neednet=1 rd.hcn.ip=10.2.2.65::10.2.0.1:255.255.255.0::env6:none"

    run_hook

    [ "$status" -eq 0 ]
    [ "$(cat "$HCN_CMDLINE_FILE")" = "ip=hcn" ]
}

@test "hcn-cmdline: writes ip=hcn when rd.hcn.route is given" {
    export MOCK_CMDLINE="rd.hcn.route=10.3.0.0/16:10.2.0.1"

    run_hook

    [ "$status" -eq 0 ]
    [ "$(cat "$HCN_CMDLINE_FILE")" = "ip=hcn" ]
}

@test "hcn-cmdline: writes ip=hcn when only rd.hcn=1 is given" {
    export MOCK_CMDLINE="rd.hcn=1"

    run_hook

    [ "$status" -eq 0 ]
    [ "$(cat "$HCN_CMDLINE_FILE")" = "ip=hcn" ]
}

# ========================================
# Test: the marker is not written
# ========================================

@test "hcn-cmdline: does nothing without HCN options" {
    export MOCK_CMDLINE="rd.neednet=1 ip=dhcp"

    run_hook

    [ "$status" -eq 0 ]
    [ ! -e "$HCN_CMDLINE_FILE" ]
}

@test "hcn-cmdline: rd.hcn=0 disables HCN even with rd.hcn.ip" {
    export MOCK_CMDLINE="rd.hcn=0 rd.hcn.ip=dhcp"

    run_hook

    [ "$status" -eq 0 ]
    [ ! -e "$HCN_CMDLINE_FILE" ]
}

@test "hcn-cmdline: keeps quiet when there is no HCN device" {
    # Otherwise the network would be left unconfigured: parse-hcn bails out and
    # the other modules would not add their "ip=dhcp" fallback
    export MOCK_CMDLINE="rd.hcn.ip=dhcp"
    export HCN_DEVICE_TREE="$EMPTY_DEVICE_TREE"

    run_hook

    [ "$status" -eq 0 ]
    [ ! -e "$HCN_CMDLINE_FILE" ]
}

@test "hcn-cmdline: keeps quiet when there is no device tree at all" {
    export MOCK_CMDLINE="rd.hcn.ip=dhcp"
    export HCN_DEVICE_TREE="$TEST_WORK_DIR/missing"

    run_hook

    [ "$status" -eq 0 ]
    [ ! -e "$HCN_CMDLINE_FILE" ]
}

# ========================================
# Test: device discovery
# ========================================

@test "hcn-cmdline: detects an HCN device below vdevice" {
    export MOCK_CMDLINE="rd.hcn=1"
    export HCN_DEVICE_TREE="$TEST_WORK_DIR/vdevice-only"
    mkdir -p "$HCN_DEVICE_TREE/vdevice/vnic@30000006"
    touch "$HCN_DEVICE_TREE/vdevice/vnic@30000006/ibm,hcn-id"

    run_hook

    [ "$status" -eq 0 ]
    [ "$(cat "$HCN_CMDLINE_FILE")" = "ip=hcn" ]
}

@test "hcn-cmdline: ignores devices without an ibm,hcn-id property" {
    export MOCK_CMDLINE="rd.hcn=1"
    export HCN_DEVICE_TREE="$TEST_WORK_DIR/no-hcn-id"
    mkdir -p "$HCN_DEVICE_TREE/vdevice/l-lan@30000003"
    touch "$HCN_DEVICE_TREE/vdevice/l-lan@30000003/local-mac-address"

    run_hook

    [ "$status" -eq 0 ]
    [ ! -e "$HCN_CMDLINE_FILE" ]
}
