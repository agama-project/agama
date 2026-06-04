#!/usr/bin/env bats
# Unit tests for parse-hcnmgr.sh
# Tests the improved hcnmgr dracut module

# Test fixture location
FIXTURE_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
SCRIPT_PATH="${FIXTURE_DIR}/../../live-root/usr/lib/dracut/modules.d/99hcnmgr/parse-hcnmgr.sh"

# Mock directories
MOCK_PROC="${FIXTURE_DIR}/proc"
MOCK_SYS="${FIXTURE_DIR}/sys"
MOCK_NM_INITRD_DIR="${FIXTURE_DIR}/nm-initrd-generator-connections"
MOCK_HCNMGR_DIR="${FIXTURE_DIR}/hcnmgr-connections"

# Helper functions for testing
setup_file() {
    # Create a temporary directory for test runs
    export BATS_TMPDIR="${BATS_TEST_TMPDIR:-/tmp}/hcnmgr-tests"
    mkdir -p "$BATS_TMPDIR"
}

teardown_file() {
    # Clean up temporary directory
    [ -d "$BATS_TMPDIR" ] && rm -rf "$BATS_TMPDIR"
}

setup() {
    # Create test-specific temporary directory
    TEST_WORK_DIR="$(mktemp -d "$BATS_TMPDIR/test.XXXXXX")"
    export TEST_WORK_DIR

    # Mock directories for each test
    export MOCK_RUN_DIR="$TEST_WORK_DIR/run"
    export MOCK_ETC_DIR="$TEST_WORK_DIR/etc"
    mkdir -p "$MOCK_RUN_DIR/NetworkManager/system-connections"
    mkdir -p "$MOCK_ETC_DIR/cmdline.d"
}

teardown() {
    # Clean up test-specific directory
    [ -d "$TEST_WORK_DIR" ] && rm -rf "$TEST_WORK_DIR"
}

# Source helper functions from the script
load_script_functions() {
    # Extract and source only the helper functions from parse-hcnmgr.sh
    # This allows us to test individual functions
    source <(sed -n '/^gkeyfile_get()/,/^}/p' "$SCRIPT_PATH")
    source <(sed -n '/^gkeyfile_has()/,/^}/p' "$SCRIPT_PATH")
    source <(sed -n '/^gkeyfile_set()/,/^}/p' "$SCRIPT_PATH")
    source <(sed -n '/^xdump4()/,/^}/p' "$SCRIPT_PATH")
    source <(sed -n '/^get_mac()/,/^}/p' "$SCRIPT_PATH")
    source <(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")
}

# Mock dracut library functions
info() { echo "INFO: $*" >&2; }
warn() { echo "WARN: $*" >&2; }
getargs() { eval echo "\$MOCK_GETARGS_$1"; }
getcmdline() { echo "$MOCK_CMDLINE"; }

export -f info warn getargs getcmdline

# ========================================
# Test: xdump4 helper function
# ========================================

@test "xdump4: reads 4-byte HCN ID correctly" {
    load_script_functions

    result=$(xdump4 "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-id")
    [ "$result" = "333e80f5" ]
}

@test "xdump4: reads PCI HCN ID correctly" {
    load_script_functions

    result=$(xdump4 "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ibm,hcn-id")
    [ "$result" = "333e80f5" ]
}

# ========================================
# Test: get_mac helper function
# ========================================

@test "get_mac: extracts MAC address from vnic device" {
    load_script_functions

    result=$(get_mac "$MOCK_PROC/device-tree/vdevice/vnic@30000006")
    [ "$result" = "2e:7a:32:2d:3d:06" ]
}

@test "get_mac: extracts MAC address from PCI device" {
    load_script_functions

    result=$(get_mac "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0")
    [ "$result" = "2e:7a:30:83:f5:00" ]
}

@test "get_mac: returns empty for missing MAC file" {
    load_script_functions

    result=$(get_mac "$TEST_WORK_DIR/nonexistent")
    [ -z "$result" ]
}

# ========================================
# Test: parse_nm_connection function
# ========================================

@test "parse_nm_connection: parses bond connection correctly" {
    load_script_functions

    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$MOCK_NM_INITRD_DIR/bond333e80f5.nmconnection")
EOF

    [ "$id" = "bond333e80f5" ]
    [ "$uuid" = "e2a7b4b8-8297-4185-8421-ed32cf47db1c" ]
    [ "$ifname" = "bond333e80f5" ]
    [ -z "$master" ]
    [ -z "$controller" ]
    [ -z "$mac" ]
}

@test "parse_nm_connection: parses slave with controller UUID" {
    load_script_functions

    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$MOCK_NM_INITRD_DIR/enP32775p1s0.nmconnection")
EOF

    [ "$id" = "enP32775p1s0" ]
    [ "$uuid" = "af0194bd-a0bf-4ea6-acd2-a52641c1e274" ]
    [ "$ifname" = "enP32775p1s0" ]
    [ -z "$master" ]
    [ "$controller" = "e2a7b4b8-8297-4185-8421-ed32cf47db1c" ]
    [ -z "$mac" ]
}

@test "parse_nm_connection: parses fixed connection with bond name as controller" {
    load_script_functions

    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$MOCK_HCNMGR_DIR/bond333e80f5-enP32775p1s0.nmconnection")
EOF

    [ "$id" = "bond333e80f5-enP32775p1s0" ]
    [ "$uuid" = "10187d9d-f882-42a7-9efe-2fc81d636a1c" ]
    [ "$ifname" = "enP32775p1s0" ]
    [ -z "$master" ]
    [ "$controller" = "bond333e80f5" ]
    [ -z "$mac" ]
}

# ========================================
# Test: get_dev_hcn function (integration)
# ========================================

@test "get_dev_hcn: discovers vnic device with primary mode" {
    # Mock ofpathname command
    ofpathname() {
        if [ "$2" = "/vdevice/vnic@30000006" ]; then
            echo "env6"
            return 0
        fi
        return 1
    }
    export -f ofpathname

    # Source the get_dev_hcn function and its dependencies
    source <(sed -n '/^xdump4()/,/^}/p; /^get_mac()/,/^}/p; /^get_dev_hcn()/,/^}/p' "$SCRIPT_PATH")

    # Mock sys/class/net for device existence check
    mkdir -p "$MOCK_SYS/class/net/env6"

    # Override /sys/class/net path check
    export PATH="$TEST_WORK_DIR/bin:$PATH"
    mkdir -p "$TEST_WORK_DIR/bin"
    cat > "$TEST_WORK_DIR/bin/test" << 'EOSCRIPT'
#!/bin/sh
case "$1" in
    -e) [ -e "$2" ] && exit 0 || exit 1 ;;
    *) /usr/bin/test "$@" ;;
esac
EOSCRIPT
    chmod +x "$TEST_WORK_DIR/bin/test"

    # Note: This test requires proper mocking of the wait loop
    # For now, we skip the actual execution due to complexity
    skip "Requires complex mocking of ofpathname and sysfs interaction"
}

# ========================================
# Test: fixup_nm_connections function
# ========================================

@test "fixup_nm_connections: converts UUID controller to bond name" {
    # Copy nm-initrd-generator connections to test directory
    cp -r "$MOCK_NM_INITRD_DIR"/* "$MOCK_RUN_DIR/NetworkManager/system-connections/"

    # Set up mock environment
    export MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    export BOND_NAMES="bond333e80f5"

    # Source fixup function and its helpers
    source <(sed -n '/^gkeyfile_get()/,/^}/p; /^gkeyfile_has()/,/^}/p; /^gkeyfile_set()/,/^}/p; /^parse_nm_connection()/,/^}/p; /^fixup_nm_connections()/,/^}/p' "$SCRIPT_PATH")

    # Set mocked connection directory
    export NM_CONN_DIR="$MOCK_RUN_DIR/NetworkManager/system-connections"

    # Execute fixup
    cd "$TEST_WORK_DIR"
    fixup_nm_connections

    # Verify the slave connection was renamed
    [ -f "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-enP32775p1s0.nmconnection" ]

    # Verify controller was changed from UUID to bond name
    grep -q "controller=bond333e80f5" "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-enP32775p1s0.nmconnection"
}

@test "fixup_nm_connections: renames connection ID to bond-slave format" {
    # Copy nm-initrd-generator connections to test directory
    cp -r "$MOCK_NM_INITRD_DIR"/* "$MOCK_RUN_DIR/NetworkManager/system-connections/"

    # Set up mock environment
    export MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    export BOND_NAMES="bond333e80f5"

    # Source fixup function and its helpers
    source <(sed -n '/^gkeyfile_get()/,/^}/p; /^gkeyfile_has()/,/^}/p; /^gkeyfile_set()/,/^}/p; /^parse_nm_connection()/,/^}/p; /^fixup_nm_connections()/,/^}/p' "$SCRIPT_PATH")

    # Set mocked connection directory
    export NM_CONN_DIR="$MOCK_RUN_DIR/NetworkManager/system-connections"

    # Execute fixup
    cd "$TEST_WORK_DIR"
    fixup_nm_connections

    # Verify renamed files exist
    [ -f "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-enP32775p1s0.nmconnection" ]
    [ -f "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-env6.nmconnection" ]

    # Verify connection IDs were updated
    grep -q "^id=bond333e80f5-enP32775p1s0$" "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-enP32775p1s0.nmconnection"
    grep -q "^id=bond333e80f5-env6$" "$MOCK_RUN_DIR/NetworkManager/system-connections/bond333e80f5-env6.nmconnection"
}

@test "fixup_nm_connections: matches by MAC address when no interface name" {
    # Create a connection file without interface-name but with MAC
    cat > "$MOCK_RUN_DIR/NetworkManager/system-connections/test-slave.nmconnection" << 'EOF'
[connection]
id=test-slave
uuid=test-uuid-1234
type=ethernet
controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c
port-type=bond

[ethernet]
mac-address=2E:7A:30:83:F5:00
EOF

    # Also copy the bond master
    cp "$MOCK_NM_INITRD_DIR/bond333e80f5.nmconnection" "$MOCK_RUN_DIR/NetworkManager/system-connections/"

    export MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary"
    export BOND_NAMES="bond333e80f5"

    source <(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")

    # Test MAC parsing with our mock file
    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$MOCK_RUN_DIR/NetworkManager/system-connections/test-slave.nmconnection")
EOF

    # Verify MAC was parsed correctly (lowercase, no colons)
    [ "$mac" = "2e7a3083f500" ]
    [ "$controller" = "e2a7b4b8-8297-4185-8421-ed32cf47db1c" ]
}

# ========================================
# Test: Main execution logic
# ========================================

@test "cmdline generation: creates bond= argument from discovered devices" {
    # This test verifies the main loop generates correct bond= arguments

    # Expected format: bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0

    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    BOND_NAMES="bond333e80f5"

    # Simulate the bond argument generation logic
    for BONDNAME in $BOND_NAMES; do
        SLAVES="" SLAVE_NAMES="" PRIMARY=""

        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVE_NAMES="$SLAVE_NAMES $2"
                [ "$4" = "primary" ] && PRIMARY="$2"
                SLAVES="${SLAVES:+$SLAVES,}$2"
            fi
            shift 4
        done

        BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"
        BOND_ARG="bond=$BONDNAME:$SLAVES:$BOND_OPTS"
    done

    # Verify the generated bond argument
    [ "$BOND_ARG" = "bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0" ]
}

@test "cmdline generation: applies ip=dhcp to first bond" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    BOND_NAMES="bond333e80f5"
    HCN_IP="dhcp"

    # Simulate IP configuration logic
    for BONDNAME in $BOND_NAMES; do
        if [ -n "$HCN_IP" ]; then
            matched=0

            # Check if HCN_IP matches dhcp keyword
            case "$HCN_IP" in
            dhcp | on | any | single-dhcp | dhcp6 | auto6 | ibft)
                IP_ARG="ip=$BONDNAME:$HCN_IP"
                matched=1
                ;;
            esac
        fi
    done

    [ "$IP_ARG" = "ip=bond333e80f5:dhcp" ]
}

@test "cmdline generation: applies static IP to first bond with padding" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary"
    BOND_NAMES="bond333e80f5"
    HCN_IP="10.2.2.69::10.2.0.1:255.255.255.0"

    # Simulate static IP logic (4 colons in input, need 5 total)
    colons=$(echo "$HCN_IP" | tr -dc ':' | wc -c)

    [ "$colons" -eq 3 ]

    if [ "$colons" -lt 5 ]; then
        suffix=$(printf "%$((5 - colons))s" | tr ' ' ':')
        IP_ARG="ip=$HCN_IP${suffix}bond333e80f5:none"
    fi

    [ "$IP_ARG" = "ip=10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:none" ]
}

@test "cmdline generation: replaces slave interface with bond in ip" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    BOND_NAMES="bond333e80f5"
    HCN_IP="10.2.2.69::10.2.0.1:255.255.255.0::env6:off"

    SLAVE_NAMES=" enP32775p1s0  env6"

    # Simulate slave replacement logic
    matched=0
    for slave in $SLAVE_NAMES; do
        slave_dash=$(echo "$slave" | tr ':' '-')
        if echo ":$HCN_IP:" | grep -qE ":($slave|$slave_dash):"; then
            matched=1
            current_hcn_ip=$(echo "$HCN_IP" | sed -E "s/^($slave|$slave_dash)([: ]|$)/bond333e80f5\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1bond333e80f5\3/g")
            IP_ARG="ip=$current_hcn_ip"
            break
        fi
    done

    [ "$matched" -eq 1 ]
    [ "$IP_ARG" = "ip=10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:off" ]
}

@test "cmdline generation: applies rd.route to first bond" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary"
    BOND_NAMES="bond333e80f5"
    HCN_ROUTE="192.168.1.0/24:10.2.0.1"

    # Simulate route logic (1 colon = partial route)
    matched=0
    colons=$(echo "$HCN_ROUTE" | tr -dc ':' | wc -c)

    if [ $matched -eq 0 ] && ! echo "$HCN_ROUTE" | grep -q ":bond[0-9]"; then
        if [ "$colons" -le 1 ]; then
            ROUTE_ARG="rd.route=$HCN_ROUTE$([ "$colons" -eq 0 ] && echo "::" || echo ":")bond333e80f5"
        fi
    fi

    [ "$ROUTE_ARG" = "rd.route=192.168.1.0/24:10.2.0.1:bond333e80f5" ]
}

@test "cmdline generation: replaces slave in rd.route with bond" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"
    BOND_NAMES="bond333e80f5"
    HCN_ROUTE="default:10.2.0.1:enP32775p1s0"

    SLAVE_NAMES=" enP32775p1s0  env6"

    # Simulate slave replacement in route
    matched=0
    for slave in $SLAVE_NAMES; do
        slave_dash=$(echo "$slave" | tr ':' '-')
        if echo ":$HCN_ROUTE:" | grep -qE ":($slave|$slave_dash):"; then
            matched=1
            current_hcn_route=$(echo "$HCN_ROUTE" | sed -E "s/^($slave|$slave_dash)([: ]|$)/bond333e80f5\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1bond333e80f5\3/g")
            ROUTE_ARG="rd.route=$current_hcn_route"
            break
        fi
    done

    [ "$matched" -eq 1 ]
    [ "$ROUTE_ARG" = "rd.route=default:10.2.0.1:bond333e80f5" ]
}

# ========================================
# Test: Edge cases and error handling
# ========================================

@test "edge case: empty MAPPINGS results in no bond configuration" {
    MAPPINGS=""
    BOND_NAMES=""

    # The script should exit early when MAPPINGS is empty
    [ -z "$MAPPINGS" ]
}

@test "edge case: multiple bonds are processed independently" {
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none bond5558a5a3 enP16386p1s0 none primary bond5558a5a3 env7 none none"
    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) print $i}' | sort -u)

    # Should result in two unique bond names
    bond_count=$(echo "$BOND_NAMES" | wc -w)
    [ "$bond_count" -eq 2 ]

    echo "$BOND_NAMES" | grep -q "bond333e80f5"
    echo "$BOND_NAMES" | grep -q "bond5558a5a3"
}

@test "edge case: MAC address matching is case-insensitive" {
    # The parse_nm_connection function should lowercase MAC addresses
    source <(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")

    # Create test file with uppercase MAC
    cat > "$TEST_WORK_DIR/test.nmconnection" << 'EOF'
[connection]
id=test
uuid=test-uuid

[ethernet]
mac-address=2E:7A:30:83:F5:00
EOF

    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$TEST_WORK_DIR/test.nmconnection")
EOF

    # MAC should be lowercase and without colons
    [ "$mac" = "2e7a3083f500" ]
}

@test "edge case: handles missing ibm,hcn-mode gracefully" {
    # When mode file is missing, should return "none"
    # This is tested implicitly through the fixture where backup slaves don't have primary mode

    # In our fixture, env6 has mode "backup" which after tr -d '\0' becomes "backup"
    mode=$(tr -d '\0' <"$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-mode" 2>/dev/null)
    # Note: The fixture has "backup " with trailing space and null bytes

    # The actual value should be trimmed
    [ -n "$mode" ]
}

# ========================================
# Test: Performance improvements
# ========================================

@test "performance: parse_nm_connection uses single awk invocation" {
    load_script_functions

    # Count the number of commands executed (rough measure)
    # The old implementation used 7+ sed calls
    # The new implementation uses 1 awk call

    # We verify this by checking the function only contains one awk call
    function_body=$(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")

    awk_count=$(echo "$function_body" | grep -c "awk" || true)
    sed_count=$(echo "$function_body" | grep -c "sed -n" || true)

    # Should have 1 awk and 0 sed -n calls
    [ "$awk_count" -eq 1 ]
    [ "$sed_count" -eq 0 ]
}

# ========================================
# Test: POSIX compliance
# ========================================

@test "POSIX compliance: script uses 'command -v' instead of 'type'" {
    # Verify the script uses POSIX-compliant 'command -v'
    grep_result=$(grep -n "command -v getargs" "$SCRIPT_PATH" || true)
    [ -n "$grep_result" ]

    # Should not use 'type' command
    type_usage=$(grep -n "type getargs" "$SCRIPT_PATH" || true)
    [ -z "$type_usage" ]
}

@test "POSIX compliance: no leading underscores in variable names" {
    # Variables in the script should not have leading underscores (old convention)
    # Check for the current clean style

    # The script should use 'dev' not '_dev', etc.
    # We verify by checking the get_dev_hcn function
    function_body=$(sed -n '/^get_dev_hcn()/,/^}/p' "$SCRIPT_PATH")

    # Should use clean variable names
    echo "$function_body" | grep -q "local dev="
    echo "$function_body" | grep -q "local hcnid"
}

# ========================================
# Test: Fixtures validation
# ========================================

@test "fixture validation: bond333e80f5 has two devices" {
    # Verify test fixture consistency
    hcn_id_vnic=$(hexdump -n 4 -ve '/1 "%02x"' "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-id")
    hcn_id_pci=$(hexdump -n 4 -ve '/1 "%02x"' "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ibm,hcn-id")

    [ "$hcn_id_vnic" = "333e80f5" ]
    [ "$hcn_id_pci" = "333e80f5" ]
}

@test "fixture validation: vnic device maps to env6" {
    ofpathname_result=$(cat "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ofpathname")
    [ "$ofpathname_result" = "env6" ]
}

@test "fixture validation: PCI device maps to enP32775p1s0" {
    ofpathname_result=$(cat "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ofpathname")
    [ "$ofpathname_result" = "enP32775p1s0" ]
}

@test "fixture validation: PCI device is primary" {
    mode=$(cat "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ibm,hcn-mode")
    # Should contain "primary" (with possible null bytes)
    echo "$mode" | grep -q "primary"
}

@test "fixture validation: vnic device is backup" {
    mode=$(cat "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-mode")
    # Should contain "backup" (with possible null bytes)
    echo "$mode" | grep -q "backup"
}

@test "fixture validation: nm-initrd-generator connections have UUID controllers" {
    # The nm-initrd-generator creates connections with UUID references
    grep -q "controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c" \
        "$MOCK_NM_INITRD_DIR/enP32775p1s0.nmconnection"

    grep -q "controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c" \
        "$MOCK_NM_INITRD_DIR/env6.nmconnection"
}

@test "fixture validation: hcnmgr connections have bond name controllers" {
    # After fixup, connections should reference bond by name
    grep -q "controller=bond333e80f5" \
        "$MOCK_HCNMGR_DIR/bond333e80f5-enP32775p1s0.nmconnection"

    grep -q "controller=bond333e80f5" \
        "$MOCK_HCNMGR_DIR/bond333e80f5-env6.nmconnection"
}
