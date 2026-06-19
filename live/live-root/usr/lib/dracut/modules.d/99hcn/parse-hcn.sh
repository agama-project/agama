#!/bin/sh

# HCN (Hybrid Cloud Network) dracut module
# Discovers HCN configurations from device-tree and sets up bonding
#
# Workflow:
# 1. Check if HCN is enabled (rd.hcn=1, rd.hcn.ip, or rd.hcn.route), exit early if not
# 2. Discover HCN devices from device-tree (/proc/device-tree)
#    - Scans PCI devices (SR-IOV ethernet adapters)
#    - Scans vdevices (VNIC and Virtual Ethernet)
# 3. Build MAPPINGS: bond names -> slave devices with MACs and modes
# 4. Process rd.hcn.ip= and rd.hcn.route= parameters and replace slave references with bonds
# 5. Generate NetworkManager connections to a temporary directory via nm-initrd-generator
# 6. Fix up generated connections to use correct bond masters and naming
# 7. Copy connections to /etc/NetworkManager/system-connections for persistence
#
# Usage:
#   rd.hcn=1              - Create bond connections only (no IP configuration)
#   rd.hcn.ip=<config>    - Create bonds with HCN-specific IP configuration
#   rd.hcn.route=<config> - Create bonds with HCN-specific route configuration

command -v getargs >/dev/null || . /lib/dracut-lib.sh

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
      info "parse-hcn: device $devname ready for $ofpath"
      mac=$(get_mac "$dev")
      break
    fi
    info "parse-hcn: waiting for device for $ofpath (retry $wait)"
    sleep 15
    wait=$((wait - 1))
  done

  if [ -z "$devname" ]; then
    warn "parse-hcn: could not resolve device name for $dev"
    return 1
  fi

  # Output the bond mapping: bondname devname mac mode
  echo "bond$hcnid $devname ${mac:-none} ${mode:-none}"
  return 0
}

# Get a value from a keyfile (INI format)
# Usage: gkeyfile_get <file> <section> <key>
gkeyfile_get() {
  awk -v sec="$2" -v key="$3" '
    $0 ~ "^[[:space:]]*\\[.*\\][[:space:]]*$" {
      current_sec = $0
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_sec)
      current_sec = substr(current_sec, 2, length(current_sec) - 2)
      in_sec = (current_sec == sec)
    }
    in_sec {
      idx = index($0, "=")
      if (idx > 0) {
        k = substr($0, 1, idx - 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", k)
        if (k == key) {
          val = substr($0, idx + 1)
          gsub(/^[[:space:]]+|[[:space:]]+$|"/, "", val)
          print val
          exit
        }
      }
    }
  ' "$1"
}

# Check if a key exists in a keyfile (INI format)
# Usage: gkeyfile_has <file> <section> <key>
gkeyfile_has() {
  awk -v sec="$2" -v key="$3" '
    $0 ~ "^[[:space:]]*\\[.*\\][[:space:]]*$" {
      current_sec = $0
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_sec)
      current_sec = substr(current_sec, 2, length(current_sec) - 2)
      in_sec = (current_sec == sec)
    }
    in_sec {
      idx = index($0, "=")
      if (idx > 0) {
        k = substr($0, 1, idx - 1)
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", k)
        if (k == key) {
          found = 1
          exit
        }
      }
    }
    END { exit !found }
  ' "$1"
}

# Set a value in a keyfile (INI format)
# Usage: gkeyfile_set <file> <section> <key> <val>
gkeyfile_set() {
  if gkeyfile_has "$1" "$2" "$3"; then
    sed -i "/^\[$2\]/,/^\[/ s|^\([[:space:]]*$3[[:space:]]*=[[:space:]]*\).*|\1$4|" "$1"
  else
    sed -i "/^\[$2\]/a $3=$4" "$1"
  fi
}

# Parse a NetworkManager connection file and extract key fields
# Returns: id|uuid|ifname|master|controller|mac (pipe-separated)
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
            print id "|" uuid "|" ifname "|" master "|" controller "|" mac
        }
    ' "$1"
}

# Function to fix up NetworkManager connection files
#
# IMPORTANT: This function should ONLY be called when rd.hcn=1 is set
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
#
# This function only modifies connections that are related to HCN bonds
# (either bond interfaces themselves or slaves found in MAPPINGS)
fixup_nm_connections() {
  local conn_dir="${HCN_RUNTIME_CONN_DIR:-$NM_RUNTIME_CONN_DIR}"
  [ -d "$conn_dir" ] || return 0

  local con id uuid ifname master controller mac uuid_map
  local found_master found_ifname mapping_info new_id

  # First pass: build UUID to ID mapping for resolution
  for con in "$conn_dir"/*.nmconnection; do
    [ -e "$con" ] || continue
    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$con")
EOF
    [ -n "$uuid" ] && [ -n "$id" ] && uuid_map="$uuid_map $uuid:$id"
  done

  # Second pass: fixup files (only those related to HCN bonds)
  for con in "$conn_dir"/*.nmconnection; do
    [ -e "$con" ] || continue

    # Extract connection details
    IFS='|' read -r id uuid ifname master controller mac <<EOF
$(parse_nm_connection "$con")
EOF

    # Guard: Ensure we have at least id and uuid
    if [ -z "$id" ] || [ -z "$uuid" ]; then
      info "parse-hcn: skipping invalid connection file $con"
      continue
    fi

    # Resolve UUIDs to names for master/controller
    for map in $uuid_map; do
      if [ "$master" = "${map%:*}" ]; then
        master=${map#*:}
        gkeyfile_set "$con" connection master "$master"
      elif [ "$controller" = "${map%:*}" ]; then
        controller=${map#*:}
        gkeyfile_set "$con" connection controller "$controller"
      fi
    done

    # Fallback if interface-name is missing
    [ -z "$ifname" ] && ifname="$id"

    # Search MAPPINGS for this connection to find the correct master
    # Only connections in MAPPINGS or with HCN bond masters will be modified
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

    # Only modify connections that are HCN-related
    if [ -n "$found_master" ]; then
      info "parse-hcn: fixing up connection $id (HCN-related)"

      # Ensure controller/master and port-type/slave-type are correct
      if gkeyfile_has "$con" connection controller; then
        gkeyfile_set "$con" connection controller "$found_master"
      elif gkeyfile_has "$con" connection master; then
        gkeyfile_set "$con" connection master "$found_master"
      else
        gkeyfile_set "$con" connection controller "$found_master"
      fi

      if gkeyfile_has "$con" connection slave-type; then
        gkeyfile_set "$con" connection slave-type bond
      else
        gkeyfile_set "$con" connection port-type bond
      fi

      # Rename connection ID and file to match expectations
      new_id="$found_master-$found_ifname"
      if [ "$id" != "$new_id" ]; then
        info "parse-hcn: renaming connection $id to $new_id"
        gkeyfile_set "$con" connection id "$new_id"
        mv "$con" "$conn_dir/$new_id.nmconnection"
      fi
    fi
  done
}

# --- Main Execution ---

info "parse-hcn: starting"

MAPPINGS=""
if [ -d /proc/device-tree ]; then
  # Scan PCI devices (SR-IOV)
  for dev in /proc/device-tree/pci*/ethernet*; do
    [ -e "$dev/ibm,hcn-id" ] || continue
    info "parse-hcn: checking PCI device $dev"
    if res=$(get_dev_hcn "$dev"); then
      MAPPINGS="$MAPPINGS $res"
    fi
  done

  # Scan vdevices (VNIC and Virtual Ethernet)
  for dev in /proc/device-tree/vdevice/vnic* /proc/device-tree/vdevice/l-lan*; do
    [ -e "$dev/ibm,hcn-id" ] || continue
    info "parse-hcn: checking vdevice $dev"
    if res=$(get_dev_hcn "$dev"); then
      MAPPINGS="$MAPPINGS $res"
    fi
  done
fi

if [ -z "$MAPPINGS" ]; then
  info "parse-hcn: no HCN devices found"
  return 0
fi

info "parse-hcn: discovered mappings: $MAPPINGS"

# Command line processing
NM_CONF_DIR="/etc/NetworkManager"
NM_CONF_CONN_DIR="$NM_CONF_DIR/system-connections"
NM_RUNTIME_DIR="/run/NetworkManager"
NM_RUNTIME_CONN_DIR="$NM_RUNTIME_DIR/system-connections"
HCN_RUNTIME_DIR="/run/hcn"
HCN_RUNTIME_CONN_DIR="$HCN_RUNTIME_DIR/system-connections"
NEW_ARGS=""

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

  info "parse-hcn: configuring bond $BONDNAME with slaves:$SLAVE_NAMES"

  # Add bond definition to NEW_ARGS
  BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"
  NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:$BOND_OPTS"

  # Process rd.hcn.ip= - replace slave names/MACs with bond name
  for HCN_IP in $(getargs rd.hcn.ip); do
    matched=0
    for slave in $SLAVE_NAMES $SLAVE_MACS; do
      slave_dash=$(str_replace "$slave" ":" "-")
      # Check if HCN_IP contains the slave (as a whole word/field)
      if strstr ":$HCN_IP:" ":$slave:" || strstr ":$HCN_IP:" ":$slave_dash:"; then
        matched=1
        # Replace slave with bond name (handle boundaries)
        current_hcn_ip=$(echo "$HCN_IP" | sed -E "s#^($slave|$slave_dash)([: ]|$)#$BONDNAME\2#; s#([: ])($slave|$slave_dash)([: ]|$)#\1$BONDNAME\3#g")
        NEW_ARGS="$NEW_ARGS ip=$current_hcn_ip"
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
      dhcp | on | any | single-dhcp | dhcp6 | auto6 | ibft | either6 | link6)
        info "parse-hcn: applying $HCN_IP to $BONDNAME"
        NEW_ARGS="$NEW_ARGS ip=$BONDNAME:$HCN_IP"
        ;;
      *:dhcp | *:on | *:any | *:dhcp6 | *:auto6 | *:link6)
        # Format: rd.hcn.ip=<interface>:{dhcp|on|any|dhcp6|auto6|link6}[:[<mtu>]]
        # Extract optional MTU field (after the method, could be followed by more colons)
        temp_ip=${HCN_IP}
        # Count colons to determine if there are extra fields
        colons=0
        while [ "${temp_ip#*:}" != "$temp_ip" ]; do
          colons=$((colons + 1))
          temp_ip=${temp_ip#*:}
        done
        # Format: interface:method[:mtu]
        # We need at least 1 colon (interface:method), optionally 2 for MTU
        if [ "$colons" -ge 1 ]; then
          info "parse-hcn: applying DHCP/auto config with optional MTU to $BONDNAME"
          NEW_ARGS="$NEW_ARGS ip=$BONDNAME:${HCN_IP#*:}"
        fi
        ;;
      *)
        # Static IP configuration - count colons to determine format
        # Standard format: rd.hcn.ip=<client-IP>:[<peer>]:<gateway-IP>:<netmask>:<client_hostname>:<interface>:{none|off|dhcp|on|any|dhcp6|auto6|ibft}[:[<dns1>][:<dns2>]]
        # Minimum fields: client-IP:gateway:netmask:hostname:interface:method (5 colons)
        # Extended: adds :dns1 and/or :dns2 (up to 7 colons)
        temp_ip=${HCN_IP}
        colons=0
        while [ "${temp_ip#*:}" != "$temp_ip" ]; do
          colons=$((colons + 1))
          temp_ip=${temp_ip#*:}
        done

        if [ "$colons" -ge 5 ]; then
          # Already has interface field, just need to replace it with bond name
          # Extract fields: we need to replace the 6th field (interface) with BONDNAME
          # Preserve any DNS fields that may follow
          # shellcheck disable=SC2034
          IFS=':' read -r f1 f2 f3 f4 f5 f6 f7 f8 f9 <<EOF
$HCN_IP
EOF
          # Reconstruct with bond name as interface (f6 position)
          # Note: f7 and beyond might be method:dns1:dns2 or just method
          if [ -n "$f9" ]; then
            # Has dns2 field
            info "parse-hcn: applying static IP config with DNS1 and DNS2 to $BONDNAME"
            NEW_ARGS="$NEW_ARGS ip=$f1:$f2:$f3:$f4:$f5:$BONDNAME:$f7:$f8:$f9"
          elif [ -n "$f8" ]; then
            # Has dns1 field
            info "parse-hcn: applying static IP config with DNS1 to $BONDNAME"
            NEW_ARGS="$NEW_ARGS ip=$f1:$f2:$f3:$f4:$f5:$BONDNAME:$f7:$f8"
          elif [ -n "$f7" ]; then
            # Standard format with method
            info "parse-hcn: applying static IP config to $BONDNAME"
            NEW_ARGS="$NEW_ARGS ip=$f1:$f2:$f3:$f4:$f5:$BONDNAME:$f7"
          else
            # Fallback - just interface name
            NEW_ARGS="$NEW_ARGS ip=$f1:$f2:$f3:$f4:$f5:$BONDNAME"
          fi
        elif [ "$colons" -lt 5 ]; then
          # Pad with colons to reach standard ip= format (legacy behavior)
          case $((5 - colons)) in
          1) suffix=":" ;;
          2) suffix="::" ;;
          3) suffix=":::" ;;
          4) suffix="::::" ;;
          5) suffix=":::::" ;;
          *) suffix="" ;;
          esac
          info "parse-hcn: applying static IP config to $BONDNAME (padded)"
          NEW_ARGS="$NEW_ARGS ip=$HCN_IP${suffix}$BONDNAME:none"
        fi
        ;;
      esac
    fi
  done

  # Process rd.hcn.route= - replace slave names/MACs with bond name
  for HCN_ROUTE in $(getargs rd.hcn.route); do
    matched=0
    for slave in $SLAVE_NAMES $SLAVE_MACS; do
      slave_dash=$(str_replace "$slave" ":" "-")
      if strstr ":$HCN_ROUTE:" ":$slave:" || strstr ":$HCN_ROUTE:" ":$slave_dash:"; then
        matched=1
        current_hcn_route=$(echo "$HCN_ROUTE" | sed -E "s#^($slave|$slave_dash)([: ]|$)#$BONDNAME\2#; s#([: ])($slave|$slave_dash)([: ]|$)#\1$BONDNAME\3#g")
        NEW_ARGS="$NEW_ARGS rd.route=$current_hcn_route"
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
        info "parse-hcn: applying route to $BONDNAME"
        NEW_ARGS="$NEW_ARGS rd.route=$HCN_ROUTE$([ "$colons" -eq 0 ] && echo "::" || echo ":")$BONDNAME"
      fi
    fi
  done
done

# Write new configuration and update NetworkManager
if [ -n "$NEW_ARGS" ]; then
  # Create runtime directory to store HCN connections
  mkdir -p "$HCN_RUNTIME_CONN_DIR"

  # Write new cmdline options
  info "parse-hcn: new cmdline arguments: $NEW_ARGS"
  echo "$NEW_ARGS" > "$HCN_RUNTIME_DIR"/cmdline

  # Find and execute nm-initrd-generator
  generator_found=0
  for gen in /usr/lib/nm-initrd-generator /usr/libexec/nm-initrd-generator; do
    [ -x "$gen" ] || continue
    generator_found=1
    info "parse-hcn: calling $gen"
    rm -f "$HCN_RUNTIME_CONN_DIR"/*
    # shellcheck disable=SC2086
    if "$gen" -c "$HCN_RUNTIME_CONN_DIR" -- $NEW_ARGS; then
      if [ "$(ls -A "$HCN_RUNTIME_CONN_DIR")" ]; then
        fixup_nm_connections
        # Persist these new HCN connections to /etc
        mkdir -p "$NM_CONF_CONN_DIR"
        cp -rf "$HCN_RUNTIME_CONN_DIR"/* "$NM_CONF_CONN_DIR"
        mkdir -p "$NM_RUNTIME_DIR"/initrd
        : > "$NM_RUNTIME_DIR"/initrd/neednet
        echo '[ -f /tmp/nm.done ]' > "$hookdir"/initqueue/finished/nm.sh
      else
        warn "parse-hcn: nm-initrd-generator did not generate any connections"
      fi
    else
      warn "parse-hcn: nm-initrd-generator failed"
    fi
    break
  done

  if [ $generator_found -eq 0 ]; then
    warn "parse-hcn: nm-initrd-generator not found"
  fi
fi
