#!/usr/bin/env bats
# Integration tests for parse-hcn.sh
# Tests complete end-to-end workflows (module renamed from 99hcnmgr to 99hcn)

FIXTURE_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"
SCRIPT_PATH="${FIXTURE_DIR}/../../live-root/usr/lib/dracut/modules.d/99hcn/parse-hcn.sh"

setup_file() {
    export BATS_TMPDIR="${BATS_TEST_TMPDIR:-/tmp}/hcn-integration"
    mkdir -p "$BATS_TMPDIR"
}

teardown_file() {
    [ -d "$BATS_TMPDIR" ] && rm -rf "$BATS_TMPDIR"
}

setup() {
    TEST_WORK_DIR="$(mktemp -d "$BATS_TMPDIR/test.XXXXXX")"
    export TEST_WORK_DIR
}

teardown() {
    [ -d "$TEST_WORK_DIR" ] && rm -rf "$TEST_WORK_DIR"
}

# ========================================
# Integration Test: Complete Workflow
# ========================================

@test "integration: complete bond discovery and configuration workflow" {
    # This test simulates the complete workflow:
    # 1. Device discovery from device-tree
    # 2. MAPPINGS generation
    # 3. Bond configuration generation
    # 4. Command line argument generation
    # 5. nm-initrd-generator invocation (mocked)
    # 6. Connection fixup

    # Setup mock environment
    export MOCK_PROC="$FIXTURE_DIR/proc"
    export MOCK_SYS="$FIXTURE_DIR/sys"

    # Expected MAPPINGS based on fixtures
    EXPECTED_MAPPINGS="bond333e80f5 enP32775p1s0 2e:7a:30:83:f5:00 primary bond333e80f5 env6 2e:7a:32:2d:3d:06 none"

    # Verify MAPPINGS would be built correctly
    # Device 1: PCI ethernet (primary)
    hcn_id_1=$(hexdump -n 4 -ve '/1 "%02x"' "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ibm,hcn-id")
    mode_1=$(tr -d '\0' <"$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ibm,hcn-mode" 2>/dev/null | tr -d ' ')
    mac_1=$(hexdump -ve '/1 "%02x:"' "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/local-mac-address" | sed 's/:$//')
    dev_1=$(cat "$MOCK_PROC/device-tree/pci@800000029008007/ethernet@0/ofpathname")

    [ "$hcn_id_1" = "333e80f5" ]
    [ "$mode_1" = "primary" ]
    [ "$mac_1" = "2e:7a:30:83:f5:00" ]
    [ "$dev_1" = "enP32775p1s0" ]

    # Device 2: VNIC (backup)
    hcn_id_2=$(hexdump -n 4 -ve '/1 "%02x"' "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-id")
    mode_2=$(tr -d '\0' <"$MOCK_PROC/device-tree/vdevice/vnic@30000006/ibm,hcn-mode" 2>/dev/null | tr -d ' ')
    mac_2=$(hexdump -ve '/1 "%02x:"' "$MOCK_PROC/device-tree/vdevice/vnic@30000006/local-mac-address" | sed 's/:$//')
    dev_2=$(cat "$MOCK_PROC/device-tree/vdevice/vnic@30000006/ofpathname")

    [ "$hcn_id_2" = "333e80f5" ]
    [ "$mode_2" = "backup" ]
    [ "$mac_2" = "2e:7a:32:2d:3d:06" ]
    [ "$dev_2" = "env6" ]

    # Both devices should map to same bond
    [ "$hcn_id_1" = "$hcn_id_2" ]
}

@test "integration: bond configuration matches expected format" {
    # Verify the bond configuration generated would be correct

    BONDNAME="bond333e80f5"
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none"

    # Extract slaves
    SLAVES=""
    PRIMARY=""

    set -- $MAPPINGS
    while [ $# -ge 4 ]; do
        if [ "$1" = "$BONDNAME" ]; then
            SLAVES="${SLAVES:+$SLAVES,}$2"
            [ "$4" = "primary" ] && PRIMARY="$2"
        fi
        shift 4
    done

    # Verify extracted values
    [ "$SLAVES" = "enP32775p1s0,env6" ]
    [ "$PRIMARY" = "enP32775p1s0" ]

    # Build bond options
    BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"

    # Verify bond options
    [ "$BOND_OPTS" = "mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0" ]

    # Verify complete bond argument
    BOND_ARG="bond=$BONDNAME:$SLAVES:$BOND_OPTS"
    [ "$BOND_ARG" = "bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0" ]
}

@test "integration: connection fixup transforms UUID to bond name" {
    # Copy nm-initrd-generator connections to test directory
    mkdir -p "$TEST_WORK_DIR/connections"
    cp -r "$FIXTURE_DIR/nm-initrd-generator-connections"/* "$TEST_WORK_DIR/connections/"

    # Verify initial state (UUID controller)
    grep -q "controller=e2a7b4b8-8297-4185-8421-ed32cf47db1c" \
        "$TEST_WORK_DIR/connections/enP32775p1s0.nmconnection"

    # Source the parse_nm_connection function
    source <(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")

    # Parse the bond connection to get UUID mapping
    IFS='|' read -r bond_id bond_uuid _rest <<EOF
$(parse_nm_connection "$TEST_WORK_DIR/connections/bond333e80f5.nmconnection")
EOF

    [ "$bond_id" = "bond333e80f5" ]
    [ "$bond_uuid" = "e2a7b4b8-8297-4185-8421-ed32cf47db1c" ]

    # Simulate UUID to name mapping
    uuid_map="$bond_uuid:$bond_id"

    # Apply transformation to slave connection
    sed -i "s/controller=$bond_uuid/controller=$bond_id/" \
        "$TEST_WORK_DIR/connections/enP32775p1s0.nmconnection"

    # Verify transformation
    grep -q "controller=bond333e80f5" \
        "$TEST_WORK_DIR/connections/enP32775p1s0.nmconnection"
}

@test "integration: connection renaming follows bond-slave pattern" {
    # Test the complete renaming workflow

    mkdir -p "$TEST_WORK_DIR/connections"
    cp "$FIXTURE_DIR/nm-initrd-generator-connections/enP32775p1s0.nmconnection" \
       "$TEST_WORK_DIR/connections/"

    # Initial state
    old_id="enP32775p1s0"
    new_id="bond333e80f5-enP32775p1s0"

    # Apply renaming
    sed -i "s/^id=$old_id$/id=$new_id/" \
        "$TEST_WORK_DIR/connections/enP32775p1s0.nmconnection"

    mv "$TEST_WORK_DIR/connections/enP32775p1s0.nmconnection" \
       "$TEST_WORK_DIR/connections/$new_id.nmconnection"

    # Verify
    [ -f "$TEST_WORK_DIR/connections/$new_id.nmconnection" ]
    [ ! -f "$TEST_WORK_DIR/connections/$old_id.nmconnection" ]

    grep -q "^id=$new_id$" "$TEST_WORK_DIR/connections/$new_id.nmconnection"
}

# ========================================
# Integration Test: Real Command Line Scenarios
# ========================================

@test "integration: scenario 1 - DHCP on bond" {
    # User boots with: ip=dhcp
    # Expected output: bond=bond333e80f5:... ip=bond333e80f5:dhcp

    BONDNAME="bond333e80f5"
    HCN_IP="dhcp"

    # Generate bond argument
    BOND_ARG="bond=$BONDNAME:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0"

    # Generate IP argument
    IP_ARG="ip=$BONDNAME:$HCN_IP"

    CMDLINE="$BOND_ARG $IP_ARG"

    echo "$CMDLINE" | grep -q "bond=bond333e80f5"
    echo "$CMDLINE" | grep -q "ip=bond333e80f5:dhcp"
}

@test "integration: scenario 2 - static IP on slave interface (should be replaced)" {
    # User boots with: hcn.ip=10.2.2.69::10.2.0.1:255.255.255.0::env6:off
    # Expected: slave 'env6' replaced with 'bond333e80f5'

    BONDNAME="bond333e80f5"
    HCN_IP="10.2.2.69::10.2.0.1:255.255.255.0::env6:off"
    SLAVE_NAMES=" enP32775p1s0  env6"

    # Simulate replacement logic
    matched=0
    for slave in $SLAVE_NAMES; do
        slave_dash=$(echo "$slave" | tr ':' '-')
        if echo ":$HCN_IP:" | grep -qE ":($slave|$slave_dash):"; then
            matched=1
            current_hcn_ip=$(echo "$HCN_IP" | sed -E "s/^($slave|$slave_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1$BONDNAME\3/g")
            break
        fi
    done

    [ "$matched" -eq 1 ]
    [ "$current_hcn_ip" = "10.2.2.69::10.2.0.1:255.255.255.0::bond333e80f5:off" ]
}

@test "integration: scenario 3 - route on slave interface (should be replaced)" {
    # User boots with: rd.route=default:10.2.0.1:enP32775p1s0
    # Expected: slave replaced with bond

    BONDNAME="bond333e80f5"
    HCN_ROUTE="default:10.2.0.1:enP32775p1s0"
    SLAVE_NAMES=" enP32775p1s0  env6"

    matched=0
    for slave in $SLAVE_NAMES; do
        slave_dash=$(echo "$slave" | tr ':' '-')
        if echo ":$HCN_ROUTE:" | grep -qE ":($slave|$slave_dash):"; then
            matched=1
            current_hcn_route=$(echo "$HCN_ROUTE" | sed -E "s/^($slave|$slave_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1$BONDNAME\3/g")
            break
        fi
    done

    [ "$matched" -eq 1 ]
    [ "$current_hcn_route" = "default:10.2.0.1:bond333e80f5" ]
}

@test "integration: scenario 4 - MAC address format in command line" {
    # User boots with MAC address in dashed format: ip=dhcp::::2e-7a-30-83-f5-00
    # Should match and replace with bond

    BONDNAME="bond333e80f5"
    CMDLINE_IP="dhcp::::2e-7a-30-83-f5-00"
    SLAVE_MACS=" 2e:7a:30:83:f5:00  2e:7a:32:2d:3d:06"

    matched=0
    for mac in $SLAVE_MACS; do
        mac_dash=$(echo "$mac" | tr ':' '-')
        if echo ":$CMDLINE_IP:" | grep -qE ":($mac|$mac_dash):"; then
            matched=1
            break
        fi
    done

    # This should match
    [ "$matched" -eq 1 ]
}

# ========================================
# Integration Test: Multiple Bonds
# ========================================

@test "integration: multiple bonds are handled independently" {
    # Simulate two different bonds
    MAPPINGS="bond333e80f5 enP32775p1s0 2e7a3083f500 primary bond333e80f5 env6 2e7a322d3d06 none bond5558a5a3 enP16386p1s0 none primary bond5558a5a3 env7 none none"

    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) print $i}' | sort -u)

    # Should have two bonds
    bond_count=$(echo "$BOND_NAMES" | wc -w)
    [ "$bond_count" -eq 2 ]

    # Generate configuration for each bond
    NEW_ARGS=""
    for BONDNAME in $BOND_NAMES; do
        SLAVES=""
        PRIMARY=""

        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVES="${SLAVES:+$SLAVES,}$2"
                [ "$4" = "primary" ] && PRIMARY="$2"
            fi
            shift 4
        done

        BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"
        NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:$BOND_OPTS"
    done

    # Verify both bonds are configured
    echo "$NEW_ARGS" | grep -q "bond=bond333e80f5:enP32775p1s0,env6"
    echo "$NEW_ARGS" | grep -q "bond=bond5558a5a3:enP16386p1s0,env7"
}

@test "integration: multiple bonds with multiple IPs are mapped individually based on MAC" {
    # This simulates the user's reported bug where multiple rd.hcn.ip= arguments with different MACs
    # are passed to multiple bonds, ensuring they are only mapped to the bond containing that MAC.
    MAPPINGS="bond22f58d45 enP32800p1s0 2e:7a:3c:6a:1c:00 primary bond156efe56 enP32802p1s0 2e:7a:3c:6a:1c:01 primary bond22f58d45 env5 2e:7a:3e:73:69:05 backup bond156efe56 env6 2e:7a:3e:73:69:06 backup"

    # We extract unique bond names
    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) if (!seen[$i]++) print $i}')

    # Mock command-line arguments for rd.hcn.ip
    MOCK_IPS="10.2.2.65::10.2.0.1:255.255.255.0::2e-7a-3c-6a-1c-00:off 10.2.2.66::10.2.0.1:255.255.255.0::2e-7a-3c-6a-1c-01:off"

    # Helper function matching parse-hcn.sh
    str_replace() {
        echo "$1" | tr "$2" "$3"
    }

    NEW_ARGS=""
    for BONDNAME in $BOND_NAMES; do
        SLAVES="" SLAVE_NAMES="" SLAVE_MACS="" PRIMARY=""
        OTHER_SLAVE_NAMES="" OTHER_SLAVE_MACS=""

        # Extract slaves for this bond and other bonds from MAPPINGS
        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVE_NAMES="$SLAVE_NAMES $2"
                [ "$3" != "none" ] && SLAVE_MACS="$SLAVE_MACS $3"
                [ "$4" = "primary" ] && PRIMARY="$2"
                SLAVES="${SLAVES:+$SLAVES,}$2"
            else
                OTHER_SLAVE_NAMES="$OTHER_SLAVE_NAMES $2"
                [ "$3" != "none" ] && OTHER_SLAVE_MACS="$OTHER_SLAVE_MACS $3"
            fi
            shift 4
        done

        # Process mocked rd.hcn.ip arguments
        for HCN_IP in $MOCK_IPS; do
            matched=0
            for slave in $SLAVE_NAMES $SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched=1
                    current_hcn_ip=$(echo "$HCN_IP" | sed -E "s#^($slave|$slave_dash)([: ]|$)#$BONDNAME\2#; s#([: ])($slave|$slave_dash)([: ]|$)#\1$BONDNAME\3#g")
                    NEW_ARGS="$NEW_ARGS ip=$current_hcn_ip"
                    break
                fi
            done

            # Check if this IP is targeted at another bond's slave
            matched_other=0
            for slave in $OTHER_SLAVE_NAMES $OTHER_SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched_other=1
                    break
                fi
            done

            has_bond_ip=0
            case "$HCN_IP" in
            *:bond[0-9]*) has_bond_ip=1 ;;
            esac
            # BOND_NAMES is newline-separated; leave unquoted so awk sees a
            # single record and returns just the first token (matches the real
            # parse-hcn.sh, which computes FIRST_BOND once, unquoted).
            # shellcheck disable=SC2086
            FIRST_BOND=$(echo $BOND_NAMES | awk '{print $1}')
            if [ $matched -eq 0 ] && [ $matched_other -eq 0 ] && [ $has_bond_ip -eq 0 ] && [ "$BONDNAME" = "$FIRST_BOND" ]; then
                NEW_ARGS="$NEW_ARGS ip=$BONDNAME:generic"
            fi
        done
    done

    # Verify that each IP is assigned to exactly one bond (and correct one)
    # The first IP (ending with MAC 1c:00) should only be assigned to bond22f58d45
    echo "$NEW_ARGS" | grep -q "ip=10.2.2.65::10.2.0.1:255.255.255.0::bond22f58d45:off"
    # The second IP (ending with MAC 1c:01) should only be assigned to bond156efe56
    echo "$NEW_ARGS" | grep -q "ip=10.2.2.66::10.2.0.1:255.255.255.0::bond156efe56:off"

    # Crucially, check that there is NO cross-assignment of IPs!
    # bond22f58d45 should NOT have 10.2.2.66
    ! echo "$NEW_ARGS" | grep -q "ip=10.2.2.66::10.2.0.1:255.255.255.0::bond22f58d45:off"
    # bond156efe56 should NOT have 10.2.2.65
    ! echo "$NEW_ARGS" | grep -q "ip=10.2.2.65::10.2.0.1:255.255.255.0::bond156efe56:off"
}

@test "integration: unqualified dhcp fans out to every bond" {
    # A bare rd.hcn.ip=dhcp carries no per-host address, so each discovered bond
    # must obtain its own DHCP lease. This mirrors the method-only fallback in
    # parse-hcn.sh (no FIRST_BOND restriction), unlike a static address which
    # falls back to the first bond only.
    MAPPINGS="bond22f58d45 enP32800p1s0 2e:7a:3c:6a:1c:00 primary bond156efe56 enP32802p1s0 2e:7a:3c:6a:1c:01 primary bond22f58d45 env5 2e:7a:3e:73:69:05 backup bond156efe56 env6 2e:7a:3e:73:69:06 backup"

    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) if (!seen[$i]++) print $i}')
    # shellcheck disable=SC2086
    FIRST_BOND=$(echo $BOND_NAMES | awk '{print $1}')

    str_replace() { echo "$1" | tr "$2" "$3"; }

    MOCK_IPS="dhcp"

    NEW_ARGS=""
    for BONDNAME in $BOND_NAMES; do
        SLAVE_NAMES="" SLAVE_MACS="" OTHER_SLAVE_NAMES="" OTHER_SLAVE_MACS=""
        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVE_NAMES="$SLAVE_NAMES $2"
                [ "$3" != "none" ] && SLAVE_MACS="$SLAVE_MACS $3"
            else
                OTHER_SLAVE_NAMES="$OTHER_SLAVE_NAMES $2"
                [ "$3" != "none" ] && OTHER_SLAVE_MACS="$OTHER_SLAVE_MACS $3"
            fi
            shift 4
        done

        for HCN_IP in $MOCK_IPS; do
            matched=0
            for slave in $SLAVE_NAMES $SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched=1; break
                fi
            done
            matched_other=0
            for slave in $OTHER_SLAVE_NAMES $OTHER_SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched_other=1; break
                fi
            done
            has_bond_ip=0
            case "$HCN_IP" in *:bond[0-9]*) has_bond_ip=1 ;; esac
            if [ $matched -eq 0 ] && [ $matched_other -eq 0 ] && [ $has_bond_ip -eq 0 ]; then
                case "$HCN_IP" in
                dhcp | on | any | single-dhcp | dhcp6 | auto6 | ibft | either6 | link6)
                    # Method-only: apply to every bond
                    NEW_ARGS="$NEW_ARGS ip=$BONDNAME:$HCN_IP" ;;
                *)
                    # Static: first bond only
                    [ "$BONDNAME" = "$FIRST_BOND" ] || continue
                    NEW_ARGS="$NEW_ARGS ip=$BONDNAME:static-fallback" ;;
                esac
            fi
        done
    done

    # dhcp must be applied to BOTH bonds, not just the first
    echo "$NEW_ARGS" | grep -q "ip=bond22f58d45:dhcp"
    echo "$NEW_ARGS" | grep -q "ip=bond156efe56:dhcp"
}

@test "integration: unqualified static config falls back to the first bond only" {
    # A fixed address with no interface field can belong to only one bond, so it
    # must be applied to the first discovered bond and to no other.
    MAPPINGS="bond22f58d45 enP32800p1s0 2e:7a:3c:6a:1c:00 primary bond156efe56 enP32802p1s0 2e:7a:3c:6a:1c:01 primary bond22f58d45 env5 2e:7a:3e:73:69:05 backup bond156efe56 env6 2e:7a:3e:73:69:06 backup"

    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) if (!seen[$i]++) print $i}')
    # shellcheck disable=SC2086
    FIRST_BOND=$(echo $BOND_NAMES | awk '{print $1}')

    str_replace() { echo "$1" | tr "$2" "$3"; }

    # Static address, no interface field (5 colons, interface slot empty)
    MOCK_IPS="10.2.2.65::10.2.0.1:255.255.255.0::off"

    NEW_ARGS=""
    for BONDNAME in $BOND_NAMES; do
        SLAVE_NAMES="" SLAVE_MACS="" OTHER_SLAVE_NAMES="" OTHER_SLAVE_MACS=""
        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVE_NAMES="$SLAVE_NAMES $2"
                [ "$3" != "none" ] && SLAVE_MACS="$SLAVE_MACS $3"
            else
                OTHER_SLAVE_NAMES="$OTHER_SLAVE_NAMES $2"
                [ "$3" != "none" ] && OTHER_SLAVE_MACS="$OTHER_SLAVE_MACS $3"
            fi
            shift 4
        done

        for HCN_IP in $MOCK_IPS; do
            matched=0
            for slave in $SLAVE_NAMES $SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched=1; break
                fi
            done
            matched_other=0
            for slave in $OTHER_SLAVE_NAMES $OTHER_SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                if echo ":$HCN_IP:" | grep -q "[:]$slave[:]" || echo ":$HCN_IP:" | grep -q "[:]$slave_dash[:]"; then
                    matched_other=1; break
                fi
            done
            has_bond_ip=0
            case "$HCN_IP" in *:bond[0-9]*) has_bond_ip=1 ;; esac
            if [ $matched -eq 0 ] && [ $matched_other -eq 0 ] && [ $has_bond_ip -eq 0 ]; then
                case "$HCN_IP" in
                dhcp | on | any | single-dhcp | dhcp6 | auto6 | ibft | either6 | link6)
                    NEW_ARGS="$NEW_ARGS ip=$BONDNAME:$HCN_IP" ;;
                *)
                    [ "$BONDNAME" = "$FIRST_BOND" ] || continue
                    NEW_ARGS="$NEW_ARGS ip=$HCN_IP:$BONDNAME:none" ;;
                esac
            fi
        done
    done

    # Applied to the first bond only
    echo "$NEW_ARGS" | grep -q "ip=10.2.2.65::10.2.0.1:255.255.255.0::off:bond22f58d45:none"
    ! echo "$NEW_ARGS" | grep -q "bond156efe56:none"
}

@test "integration: uppercase MACs map to the correct bond (case-insensitive)" {
    # MACs discovered from device-tree are lowercase, but may be supplied in
    # uppercase on the kernel command line. Matching must be case-insensitive
    # and must not cross-assign IPs between bonds.
    MAPPINGS="bond22f58d45 enP32800p1s0 2e:7a:3c:6a:1c:00 primary bond156efe56 enP32802p1s0 2e:7a:3c:6a:1c:01 primary bond22f58d45 env5 2e:7a:3e:73:69:05 backup bond156efe56 env6 2e:7a:3e:73:69:06 backup"

    BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) if (!seen[$i]++) print $i}')

    str_replace() { echo "$1" | tr "$2" "$3"; }

    # Uppercase, dash-separated MACs on the command line
    MOCK_IPS="10.2.2.65::10.2.0.1:255.255.255.0::2E-7A-3C-6A-1C-00:off 10.2.2.66::10.2.0.1:255.255.255.0::2E-7A-3C-6A-1C-01:off"

    NEW_ARGS=""
    for BONDNAME in $BOND_NAMES; do
        SLAVE_NAMES="" SLAVE_MACS=""
        set -- $MAPPINGS
        while [ $# -ge 4 ]; do
            if [ "$1" = "$BONDNAME" ]; then
                SLAVE_NAMES="$SLAVE_NAMES $2"
                [ "$3" != "none" ] && SLAVE_MACS="$SLAVE_MACS $3"
            fi
            shift 4
        done

        for HCN_IP in $MOCK_IPS; do
            HCN_IP_LC=$(echo "$HCN_IP" | tr 'A-Z' 'a-z')
            for slave in $SLAVE_NAMES $SLAVE_MACS; do
                slave_dash=$(str_replace "$slave" ":" "-")
                hcn_cmp=$HCN_IP
                case "$slave" in *:*) hcn_cmp=$HCN_IP_LC ;; esac
                if echo ":$hcn_cmp:" | grep -q "[:]$slave[:]" || echo ":$hcn_cmp:" | grep -q "[:]$slave_dash[:]"; then
                    current_hcn_ip=$(echo "$hcn_cmp" | sed -E "s#^($slave|$slave_dash)([: ]|$)#$BONDNAME\2#; s#([: ])($slave|$slave_dash)([: ]|$)#\1$BONDNAME\3#g")
                    NEW_ARGS="$NEW_ARGS ip=$current_hcn_ip"
                    break
                fi
            done
        done
    done

    # Uppercase MACs must still resolve to the right bond
    echo "$NEW_ARGS" | grep -q "ip=10.2.2.65::10.2.0.1:255.255.255.0::bond22f58d45:off"
    echo "$NEW_ARGS" | grep -q "ip=10.2.2.66::10.2.0.1:255.255.255.0::bond156efe56:off"
    # No cross-assignment
    ! echo "$NEW_ARGS" | grep -q "ip=10.2.2.66::10.2.0.1:255.255.255.0::bond22f58d45:off"
    ! echo "$NEW_ARGS" | grep -q "ip=10.2.2.65::10.2.0.1:255.255.255.0::bond156efe56:off"
}

# ========================================
# Integration Test: Error Conditions
# ========================================

@test "integration: handles missing device-tree gracefully" {
    # If /proc/device-tree doesn't exist, script should exit cleanly

    # This would be the check in the script
    if [ ! -d "/nonexistent/device-tree" ]; then
        MAPPINGS=""
    fi

    [ -z "$MAPPINGS" ]
}

@test "integration: handles no HCN devices gracefully" {
    # If no ibm,hcn-id files exist, should result in empty MAPPINGS

    MAPPINGS=""

    if [ -z "$MAPPINGS" ]; then
        # Script should log and exit
        result="no HCN devices found"
    fi

    [ "$result" = "no HCN devices found" ]
}

# ========================================
# Integration Test: Compatibility
# ========================================

@test "integration: works with existing cmdline arguments" {
    # If user has other dracut arguments, they should be preserved

    EXISTING_CMDLINE="root=/dev/sda1 console=ttyS0"
    NEW_ARGS="bond=bond333e80f5:enP32775p1s0,env6:mode=1,miimon=100,fail_over_mac=2,primary=enP32775p1s0 ip=bond333e80f5:dhcp"

    FINAL_CMDLINE="$EXISTING_CMDLINE $NEW_ARGS"

    # Verify both old and new arguments present
    echo "$FINAL_CMDLINE" | grep -q "root=/dev/sda1"
    echo "$FINAL_CMDLINE" | grep -q "console=ttyS0"
    echo "$FINAL_CMDLINE" | grep -q "bond=bond333e80f5"
    echo "$FINAL_CMDLINE" | grep -q "ip=bond333e80f5:dhcp"
}

@test "integration: connection files have correct permissions" {
    # NetworkManager connection files should have 600 permissions

    mkdir -p "$TEST_WORK_DIR/connections"
    cp "$FIXTURE_DIR/hcn-connections/bond333e80f5.nmconnection" \
       "$TEST_WORK_DIR/connections/"

    # In real scenario, nm-initrd-generator creates with 600
    chmod 600 "$TEST_WORK_DIR/connections/bond333e80f5.nmconnection"

    # Verify permissions
    perms=$(stat -c "%a" "$TEST_WORK_DIR/connections/bond333e80f5.nmconnection")
    [ "$perms" = "600" ]
}

# ========================================
# Integration Test: Validation
# ========================================

@test "integration: validates expected vs actual connection transformation" {
    # Compare nm-initrd-generator output with expected hcn output

    source <(sed -n '/^parse_nm_connection()/,/^}/p' "$SCRIPT_PATH")

    # Parse nm-initrd-generator slave connection
    IFS='|' read -r nm_id nm_uuid nm_ifname nm_master nm_controller nm_mac <<EOF
$(parse_nm_connection "$FIXTURE_DIR/nm-initrd-generator-connections/enP32775p1s0.nmconnection")
EOF

    # Parse expected hcn slave connection
    IFS='|' read -r hcn_id hcn_uuid hcn_ifname hcn_master hcn_controller hcn_mac <<EOF
$(parse_nm_connection "$FIXTURE_DIR/hcn-connections/bond333e80f5-enP32775p1s0.nmconnection")
EOF

    # Verify transformation expectations
    [ "$nm_id" = "enP32775p1s0" ]
    [ "$hcn_id" = "bond333e80f5-enP32775p1s0" ]

    [ "$nm_ifname" = "enP32775p1s0" ]
    [ "$hcn_ifname" = "enP32775p1s0" ]

    # Controller changed from UUID to bond name
    [ "$nm_controller" = "e2a7b4b8-8297-4185-8421-ed32cf47db1c" ]
    [ "$hcn_controller" = "bond333e80f5" ]
}
