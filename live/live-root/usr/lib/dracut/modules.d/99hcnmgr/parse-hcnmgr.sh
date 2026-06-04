#!/bin/sh

# HCN (Hybrid Cloud Network) dracut module
# Discovers HCN configurations from device-tree and sets up bonding
#
# Workflow:
# 1. Check if rd.hcn is enabled via kernel parameter, exit early if not
# 2. Discover HCN devices from device-tree (/proc/device-tree)
#    - Scans PCI devices (SR-IOV ethernet adapters)
#    - Scans vdevices (VNIC and Virtual Ethernet)
# 3. Build MAPPINGS: bond names -> slave devices with MACs and modes
# 4. Process kernel command line (ip=, rd.route=) and replace slave references with bonds
# 5. Generate NetworkManager connections via nm-initrd-generator
# 6. Fix up generated connections to use correct bond masters and naming
# 7. Signal NetworkManager to start via /tmp/nm.done hook
#
# Usage:
#   Add rd.hcn=1 to kernel command line to enable HCN configuration
#   Use standard ip= and rd.route= parameters (not hcn.ip/hcn.route)

command -v getargs >/dev/null || . /lib/dracut-lib.sh

if ! getargbool 0 rd.hcn; then
  warn "hcnmgr: HCN not enabled"
  if (return 0 2>/dev/null); then
    return 0
  else
    exit 0
  fi
fi

info "hcnmgr: starting"

# Helper to read 4 bytes from device-tree and return hex string
xdump4() {
  hexdump -n 4 -ve '/1 "%02x"' "$1"
}

# Helper to get MAC address from device-tree
get_mac() {
  local dev=$1
  if [ -f "$dev/local-mac-address" ]; then
    hexdump -ve '/1 "%02x:"' "$dev/local-mac-address" | sed 's/:$//'
  fi
}

# Function to discover HCN mapping for a device-tree node
get_dev_hcn() {
  local dev=$1
  local hcnid devname mode mac ofpath
  # Wait up to 3 minutes for device to appear after migration (12 * 15s)
  local wait=12

  hcnid=$(xdump4 "$dev/ibm,hcn-id")
  [ -z "$hcnid" ] && return 1

  mode=$(tr -d '\0' <"$dev/ibm,hcn-mode" 2>/dev/null)
  ofpath=${dev#/proc/device-tree}

  # Wait for device to appear in sysfs. This might take time after migration.
  while [ $wait -gt 0 ]; do
    if devname=$(ofpathname -l "$ofpath" 2>/dev/null) && [ -e "/sys/class/net/$devname" ]; then
      info "hcnmgr: device $devname ready for $ofpath"
      mac=$(get_mac "$dev")
      break
    fi
    info "hcnmgr: waiting for device for $ofpath (retry $wait)"
    sleep 15
    wait=$((wait - 1))
  done

  if [ -z "$devname" ]; then
    warn "hcnmgr: could not resolve device name for $dev"
    return 1
  fi

  # Output the bond mapping: bondname devname mac mode
  echo "bond$hcnid $devname ${mac:-none} ${mode:-none}"
  return 0
}

# Parse a NetworkManager connection file and extract key fields
# Returns: id uuid ifname master controller mac (space-separated)
parse_nm_connection() {
  awk -F'=' '
        /^[[:space:]]*id[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", $2)
            id = $2
        }
        /^[[:space:]]*uuid[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", $2)
            uuid = $2
        }
        /^[[:space:]]*interface-name[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", $2)
            ifname = $2
        }
        /^[[:space:]]*master[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", $2)
            master = $2
        }
        /^[[:space:]]*controller[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", $2)
            controller = $2
        }
        /^[[:space:]]*mac-address[[:space:]]*=/ {
            gsub(/^[[:space:]]+|[[:space:]]+$|:|"/, "", $2)
            mac = tolower($2)
        }
        END {
            print id, uuid, ifname, master, controller, mac
        }
    ' "$1"
}

# Function to fix up NetworkManager connection files
#
# nm-initrd-generator creates connections with:
#   - Interface names as connection IDs (e.g., "eth0")
#   - UUIDs as master/controller references instead of bond names
#   - Generic interface-name settings
#
# We need to transform these to:
#   - Bond-based connection IDs (e.g., "bond0-eth0")
#   - Bond names as master/controller references (e.g., "bond0")
#   - Correct slave-type/port-type set to 'bond'
#   - Match slaves to correct bonds based on MAPPINGS
fixup_nm_connections() {
  local conn_dir="/run/NetworkManager/system-connections"
  [ -d "$conn_dir" ] || return 0

  local con id uuid ifname master controller mac uuid_map
  local found_master found_ifname mapping_info new_id

  # First pass: build UUID to ID mapping for resolution
  for con in "$conn_dir"/*.nmconnection; do
    [ -e "$con" ] || continue
    read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$con")
EOF
    [ -n "$uuid" ] && [ -n "$id" ] && uuid_map="$uuid_map $uuid:$id"
  done

  # Second pass: fixup files
  for con in "$conn_dir"/*.nmconnection; do
    [ -e "$con" ] || continue

    # Extract connection details
    read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$con")
EOF

    # Resolve UUIDs to names for master/controller
    for map in $uuid_map; do
      if [ "$master" = "${map%:*}" ]; then
        master=${map#*:}
        sed -i "s/^[[:space:]]*master[[:space:]]*=.*/master=$master/" "$con"
      elif [ "$controller" = "${map%:*}" ]; then
        controller=${map#*:}
        sed -i "s/^[[:space:]]*controller[[:space:]]*=.*/controller=$controller/" "$con"
      fi
    done

    # Fallback if interface-name is missing
    [ -z "$ifname" ] && ifname="$id"

    # Search MAPPINGS for this connection to find the correct master
    mapping_info=$(echo "$MAPPINGS" | awk -v iface="$ifname" -v mac="$mac" '
            {
                for (i=1; i<=NF; i+=4) {
                    m_bond = $(i)
                    m_iface = $(i+1)
                    m_mac = $(i+2)
                    gsub(/:/, "", m_mac)
                    m_mac = tolower(m_mac)
                    if ((iface != "" && m_iface == iface) || (mac != "" && m_mac == mac)) {
                        print m_bond, m_iface
                        exit
                    }
                }
            }
        ')

    if [ -n "$mapping_info" ]; then
      found_master=${mapping_info% *}
      found_ifname=${mapping_info#* }
    elif strstr " $BOND_NAMES " " ${master:-$controller} "; then
      found_master=${master:-$controller}
      found_ifname=$ifname
    fi

    if [ -n "$found_master" ]; then
      # Ensure controller/master and port-type/slave-type are correct
      if grep -q "^[[:space:]]*controller=" "$con"; then
        sed -i "s/^[[:space:]]*controller[[:space:]]*=.*/controller=$found_master/" "$con"
      elif grep -q "^[[:space:]]*master=" "$con"; then
        sed -i "s/^[[:space:]]*master[[:space:]]*=.*/master=$found_master/" "$con"
      else
        sed -i "/^\[connection\]/a controller=$found_master" "$con"
      fi

      if grep -q "^[[:space:]]*port-type=" "$con"; then
        sed -i "s/^[[:space:]]*port-type[[:space:]]*=.*/port-type=bond/" "$con"
      elif grep -q "^[[:space:]]*slave-type=" "$con"; then
        sed -i "s/^[[:space:]]*slave-type[[:space:]]*=.*/slave-type=bond/" "$con"
      else
        sed -i "/^\[connection\]/a port-type=bond" "$con"
      fi

      # Rename connection ID and file to match expectations
      new_id="$found_master-$found_ifname"
      if [ "$id" != "$new_id" ]; then
        info "hcnmgr: renaming connection $id to $new_id"
        sed -i "s/^[[:space:]]*id[[:space:]]*=.*/id=$new_id/" "$con"
        mv "$con" "$conn_dir/$new_id.nmconnection"
      fi
    fi
  done
}

# --- Main Execution ---

MAPPINGS=""
if [ -d /proc/device-tree ]; then
  # Scan PCI devices (SR-IOV)
  for dev in /proc/device-tree/pci*/ethernet*; do
    [ -e "$dev/ibm,hcn-id" ] || continue
    info "hcnmgr: checking PCI device $dev"
    if res=$(get_dev_hcn "$dev"); then
      MAPPINGS="$MAPPINGS $res"
    fi
  done

  # Scan vdevices (VNIC and Virtual Ethernet)
  for dev in /proc/device-tree/vdevice/vnic* /proc/device-tree/vdevice/l-lan*; do
    [ -e "$dev/ibm,hcn-id" ] || continue
    info "hcnmgr: checking vdevice $dev"
    if res=$(get_dev_hcn "$dev"); then
      MAPPINGS="$MAPPINGS $res"
    fi
  done
fi

if [ -z "$MAPPINGS" ]; then
  info "hcnmgr: no HCN devices found"
else
  info "hcnmgr: discovered mappings: $MAPPINGS"

  # Command line processing
  HCN_IP=$(getargs ip)
  HCN_ROUTE=$(getargs rd.route)

  NEW_ARGS=""
  command -v getcmdline >/dev/null || . /lib/dracut-lib.sh
  MOD_CMDLINE=$(getcmdline)
  CHANGED=0

  # Extract unique bond names from discovered mappings
  BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) if (!seen[$i]++) print $i}')

  for BONDNAME in $BOND_NAMES; do
    SLAVES="" SLAVE_NAMES="" SLAVE_MACS="" PRIMARY=""

    # Extract slaves for this bond from MAPPINGS
    set -- $MAPPINGS
    while [ $# -ge 4 ]; do
      if [ "$1" = "$BONDNAME" ]; then
        SLAVE_NAMES="$SLAVE_NAMES $2"
        [ "$3" != "none" ] && SLAVE_MACS="$SLAVE_MACS $3"
        [ "$4" = "primary" ] && PRIMARY="$2"
        SLAVES="${SLAVES:+$SLAVES,}$2"
      fi
      shift 4
    done

    info "hcnmgr: configuring bond $BONDNAME with slaves:$SLAVE_NAMES"

    # Add bond definition to NEW_ARGS
    BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"
    NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:$BOND_OPTS"

    # Process hcn.ip - replace slave names/MACs with bond name
    if [ -n "$HCN_IP" ]; then
      matched=0
      for slave in $SLAVE_NAMES $SLAVE_MACS; do
        slave_dash=$(str_replace "$slave" ":" "-")
        # Check if HCN_IP contains the slave (as a whole word/field)
        if strstr ":$HCN_IP:" ":$slave:" || strstr ":$HCN_IP:" ":$slave_dash:"; then
          matched=1
          # Replace slave with bond name (handle boundaries)
          current_hcn_ip=$(echo "$HCN_IP" | sed -E "s/^($slave|$slave_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1$BONDNAME\3/g")
          NEW_ARGS="$NEW_ARGS ip=$current_hcn_ip"
          CHANGED=1
          break
        fi
      done

      # No slave matched and no bond name present - apply to first bond
      has_bond_ip=0
      case "$HCN_IP" in
        *:bond[0-9]*) has_bond_ip=1 ;;
      esac
      if [ $matched -eq 0 ] && [ $has_bond_ip -eq 0 ]; then
        case "$HCN_IP" in
        dhcp | on | any | single-dhcp | dhcp6 | auto6 | ibft)
          info "hcnmgr: applying $HCN_IP to $BONDNAME"
          NEW_ARGS="$NEW_ARGS ip=$BONDNAME:$HCN_IP"
          CHANGED=1
          ;;
        *)
          # Static IP configuration - count colons to determine format
          temp_ip=${HCN_IP}
          colons=0
          while [ "${temp_ip#*:}" != "$temp_ip" ]; do
            colons=$((colons + 1))
            temp_ip=${temp_ip#*:}
          done
          if [ "$colons" -lt 5 ]; then
            # Pad with colons to reach standard ip= format
            case $((5 - colons)) in
              1) suffix=":" ;;
              2) suffix="::" ;;
              3) suffix=":::" ;;
              4) suffix="::::" ;;
              5) suffix=":::::" ;;
              *) suffix="" ;;
            esac
            info "hcnmgr: applying static IP config to $BONDNAME"
            NEW_ARGS="$NEW_ARGS ip=$HCN_IP${suffix}$BONDNAME:none"
            CHANGED=1
          fi
          ;;
        esac
      fi
    fi

    # Process hcn.route - replace slave names/MACs with bond name
    if [ -n "$HCN_ROUTE" ]; then
      matched=0
      for slave in $SLAVE_NAMES $SLAVE_MACS; do
        slave_dash=$(str_replace "$slave" ":" "-")
        if strstr ":$HCN_ROUTE:" ":$slave:" || strstr ":$HCN_ROUTE:" ":$slave_dash:"; then
          matched=1
          current_hcn_route=$(echo "$HCN_ROUTE" | sed -E "s/^($slave|$slave_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($slave|$slave_dash)([: ]|$)/\1$BONDNAME\3/g")
          NEW_ARGS="$NEW_ARGS rd.route=$current_hcn_route"
          CHANGED=1
          break
        fi
      done

      # No slave matched and no bond name present - apply to first bond
      has_bond_route=0
      case "$HCN_ROUTE" in
        *:bond[0-9]*) has_bond_route=1 ;;
      esac
      if [ $matched -eq 0 ] && [ $has_bond_route -eq 0 ]; then
        temp_route=${HCN_ROUTE}
        colons=0
        while [ "${temp_route#*:}" != "$temp_route" ]; do
          colons=$((colons + 1))
          temp_route=${temp_route#*:}
        done
        if [ "$colons" -le 1 ]; then
          info "hcnmgr: applying route to $BONDNAME"
          NEW_ARGS="$NEW_ARGS rd.route=$HCN_ROUTE$([ "$colons" -eq 0 ] && echo "::" || echo ":")$BONDNAME"
          CHANGED=1
        fi
      fi
    fi

    # Replace slave references in existing command line (ip= and rd.route=)
    for slave in $SLAVE_NAMES $SLAVE_MACS; do
      slave_dash=$(str_replace "$slave" ":" "-")
      if strstr "$MOD_CMDLINE" "$slave" || strstr "$MOD_CMDLINE" "$slave_dash"; then
        info "hcnmgr: replacing slave $slave in cmdline with $BONDNAME"
        MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed -E "s/([:=])($slave|$slave_dash)([: ]|$)/\1$BONDNAME\3/g")
        CHANGED=1
      fi
    done
  done

  # Write new configuration and update NetworkManager
  if [ $CHANGED -eq 1 ] || [ -n "$NEW_ARGS" ]; then
    info "hcnmgr: writing /etc/cmdline.d/99-hcnmgr.conf"
    if ! echo "$NEW_ARGS" >/etc/cmdline.d/99-hcnmgr.conf; then
      warn "hcnmgr: failed to write configuration file"
      exit 1
    fi

    export CMDLINE="$MOD_CMDLINE $NEW_ARGS"

    # Find and execute nm-initrd-generator
    # Try standard paths first, then fall back to PATH search
    generator_found=0
    for gen in /usr/lib/NetworkManager/nm-initrd-generator /usr/libexec/nm-initrd-generator $(command -v nm-initrd-generator 2>/dev/null); do
      if [ -n "$gen" ] && [ -x "$gen" ]; then
        info "hcnmgr: calling $gen"
        # shellcheck disable=SC2086
        if "$gen" -- $CMDLINE; then
          fixup_nm_connections
          mkdir -p /run/NetworkManager/initrd
          : >/run/NetworkManager/initrd/neednet
          echo '[ -f /tmp/nm.done ]' > "$hookdir"/initqueue/finished/nm.sh
          generator_found=1
        else
          warn "hcnmgr: nm-initrd-generator failed"
        fi
        break
      fi
    done

    if [ $generator_found -eq 0 ]; then
      warn "hcnmgr: nm-initrd-generator not found"
    fi
  fi
fi
