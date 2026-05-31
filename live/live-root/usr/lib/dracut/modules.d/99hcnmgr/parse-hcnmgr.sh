#!/bin/sh

# HCN (Hybrid Cloud Network) dracut module
# Discovers HCN configurations from device-tree and sets up bonding

type getargs >/dev/null 2>&1 || . /lib/dracut-lib.sh

info "parse-hcnmgr: starting"

# Helper to read 4 bytes from device-tree and return hex string
xdump4() {
  hexdump -n 4 -ve '/1 "%02x"' "$1"
}

# Helper to get MAC address from device-tree
get_mac() {
  local _dev=$1
  if [ -f "$_dev/local-mac-address" ]; then
    hexdump -ve '/1 "%02x:"' "$_dev/local-mac-address" | sed 's/:$//'
  fi
}

# Function to discover HCN mapping for a device-tree node
get_dev_hcn() {
  local _dev=$1
  local _hcnid _devname _mode _mac _ofpath
  local _wait=12

  _hcnid=$(xdump4 "$_dev"/ibm,hcn-id)
  [ -z "$_hcnid" ] && return 1

  _mode=$(tr -d '\0' <"$_dev"/ibm,hcn-mode 2>/dev/null)
  _ofpath=${_dev#/proc/device-tree}

  # Wait for device to appear in sysfs. This might take time after migration.
  while [ $_wait -gt 0 ]; do
    if _devname=$(ofpathname -l "$_ofpath" 2>/dev/null) && [ -e "/sys/class/net/$_devname" ]; then
      info "parse-hcnmgr: device $_devname ready for $_ofpath"
      _mac=$(get_mac "$_dev")
      break
    fi
    info "parse-hcnmgr: waiting for device for $_ofpath (retry $_wait)"
    sleep 15
    _wait=$((_wait - 1))
  done

  if [ -z "$_devname" ]; then
    warn "parse-hcnmgr: could not resolve device name for $_dev"
    return 1
  fi

  # Output the bond mapping: bondname devname mac mode
  echo "bond$_hcnid $_devname ${_mac:-none} ${_mode:-none}"
  return 0
}

# Function to fix up NetworkManager connection files
# nm-initrd-generator uses interface names as IDs and UUIDs for masters.
# We want bond<ID>-<port> IDs and names for masters.
fixup_nm_connections() {
  local _conn_dir="/run/NetworkManager/system-connections"
  [ -d "$_conn_dir" ] || return 0

  local _con _id _uuid _ifname _master _controller _mac _uuid_map
  local _found_master _found_ifname _mapping_info _new_id _new_con

  # First pass: map UUIDs to IDs for resolution
  for _con in "$_conn_dir"/*.nmconnection; do
    [ -f "$_con" ] || continue
    _id=$(sed -n 's/^[[:space:]]*id[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    _uuid=$(sed -n 's/^[[:space:]]*uuid[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    [ -n "$_uuid" ] && [ -n "$_id" ] && _uuid_map="$_uuid_map $_uuid:$_id"
  done

  # Second pass: fixup files
  for _con in "$_conn_dir"/*.nmconnection; do
    [ -f "$_con" ] || continue

    # Extract connection details
    _id=$(sed -n 's/^[[:space:]]*id[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    _ifname=$(sed -n 's/^[[:space:]]*interface-name[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    _master=$(sed -n 's/^[[:space:]]*master[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    _controller=$(sed -n 's/^[[:space:]]*controller[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | sed 's/[[:space:]]*$//')
    _mac=$(sed -n 's/^[[:space:]]*mac-address[[:space:]]*=[[:space:]]*//p' "$_con" | head -n1 | tr -d '\r\n"' | tr '[:upper:]' '[:lower:]' | tr -d ':')

    # Resolve UUIDs to names for master/controller
    for _map in $_uuid_map; do
      if [ "$_master" = "${_map%:*}" ]; then
        _master=${_map#*:}
        sed -i "s/^[[:space:]]*master[[:space:]]*=.*/master=$_master/" "$_con"
      elif [ "$_controller" = "${_map%:*}" ]; then
        _controller=${_map#*:}
        sed -i "s/^[[:space:]]*controller[[:space:]]*=.*/controller=$_controller/" "$_con"
      fi
    done

    # Fallback if interface-name is missing
    [ -z "$_ifname" ] && _ifname="$_id"

    # Search MAPPINGS for this connection to find the correct master
    _mapping_info=$(echo "$MAPPINGS" | awk -v iface="$_ifname" -v mac="$_mac" '
      {
        for (i=1; i<=NF; i+=4) {
          m_bond=$(i); m_iface=$(i+1); m_mac=$(i+2);
          gsub(/:/, "", m_mac); m_mac = tolower(m_mac);
          if ((iface != "" && m_iface == iface) || (mac != "" && m_mac == mac)) {
            print m_bond, m_iface; exit;
          }
        }
      }
    ')

    if [ -n "$_mapping_info" ]; then
      _found_master=${_mapping_info% *}
      _found_ifname=${_mapping_info#* }
    elif echo " $BOND_NAMES " | grep -q " ${_master:-$_controller} "; then
      _found_master=${_master:-$_controller}
      _found_ifname=$_ifname
    fi

    if [ -n "$_found_master" ]; then
      # Ensure controller/master and port-type/slave-type are correct
      if grep -q "^[[:space:]]*controller=" "$_con"; then
        sed -i "s/^[[:space:]]*controller[[:space:]]*=.*/controller=$_found_master/" "$_con"
      elif grep -q "^[[:space:]]*master=" "$_con"; then
        sed -i "s/^[[:space:]]*master[[:space:]]*=.*/master=$_found_master/" "$_con"
      else
        sed -i "/^\[connection\]/a controller=$_found_master" "$_con"
      fi

      if grep -q "^[[:space:]]*port-type=" "$_con"; then
        sed -i "s/^[[:space:]]*port-type[[:space:]]*=.*/port-type=bond/" "$_con"
      elif grep -q "^[[:space:]]*slave-type=" "$_con"; then
        sed -i "s/^[[:space:]]*slave-type[[:space:]]*=.*/slave-type=bond/" "$_con"
      else
        sed -i "/^\[connection\]/a port-type=bond" "$_con"
      fi

      # Rename connection ID to match expectations
      _new_id="$_found_master-$_found_ifname"
      if [ "$_id" != "$_new_id" ]; then
        info "parse-hcnmgr: renaming connection $_id to $_new_id"
        sed -i "s/^[[:space:]]*id[[:space:]]*=.*/id=$_new_id/" "$_con"
        mv "$_con" "$_conn_dir/$_new_id.nmconnection"
      fi
    fi
  done
}

# --- Main Execution ---

MAPPINGS=""
if [ -d /proc/device-tree ]; then
  # Scan PCI devices (SR-IOV)
  for _dev in /proc/device-tree/pci*/ethernet*; do
    [ -e "$_dev/ibm,hcn-id" ] || continue
    info "parse-hcnmgr: checking PCI device $_dev"
    _res=$(get_dev_hcn "$_dev") && MAPPINGS="$MAPPINGS $_res"
  done

  # Scan vdevices (VNIC and Virtual Ethernet)
  for _dev in /proc/device-tree/vdevice/vnic* /proc/device-tree/vdevice/l-lan*; do
    [ -e "$_dev/ibm,hcn-id" ] || continue
    info "parse-hcnmgr: checking vdevice $_dev"
    _res=$(get_dev_hcn "$_dev") && MAPPINGS="$MAPPINGS $_res"
  done
fi

if [ -z "$MAPPINGS" ]; then
  info "parse-hcnmgr: no mappings found"
  [ "$0" = "/init" ] || [ "$0" = "/lib/dracut/dracut-initqueue.sh" ] && return 0 || exit 0
fi

info "parse-hcnmgr: mappings found: $MAPPINGS"

# Command line processing
[ -z "$CMDLINE" ] && [ -r /proc/cmdline ] && CMDLINE=$(cat /proc/cmdline)
HCN_IP=$(getargs hcn.ip)
HCN_ROUTE=$(getargs hcn.route)

NEW_ARGS=""
MOD_CMDLINE="$CMDLINE"
CHANGED=0

# Unique bond names from discovered mappings
BOND_NAMES=$(echo "$MAPPINGS" | awk '{for(i=1;i<=NF;i+=4) print $i}' | sort -u)

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

  info "parse-hcnmgr: processing bond $BONDNAME with slaves: $SLAVE_NAMES"

  # Add bond definition to NEW_ARGS
  BOND_OPTS="mode=1,miimon=100,fail_over_mac=2${PRIMARY:+,primary=$PRIMARY}"
  NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:$BOND_OPTS"

  # Process hcn.ip - replace slave names/MACs with bond name
  if [ -n "$HCN_IP" ]; then
    _matched=0
    for _s in $SLAVE_NAMES $SLAVE_MACS; do
      _s_dash=$(echo "$_s" | tr ':' '-')
      # Check if HCN_IP contains the slave (as a whole word/field)
      if echo ":$HCN_IP:" | grep -qE ":($_s|$_s_dash):"; then
        _matched=1
        # Replace with boundaries: start of string or colon -> bond name -> end of string or colon
        _current_hcn_ip=$(echo "$HCN_IP" | sed -E "s/^($_s|$_s_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($_s|$_s_dash)([: ]|$)/\1$BONDNAME\3/g")
        NEW_ARGS="$NEW_ARGS ip=$_current_hcn_ip"
        CHANGED=1
        break
      fi
    done

    if [ $_matched -eq 0 ] && ! echo "$HCN_IP" | grep -q ":bond[0-9]"; then
      case "$HCN_IP" in
      dhcp | on | any | dhcp6 | auto6 | ibft)
        info "parse-hcnmgr: applying $HCN_IP to $BONDNAME"
        NEW_ARGS="$NEW_ARGS ip=$BONDNAME:$HCN_IP"
        CHANGED=1
        ;;
      *)
        _colons=$(echo "$HCN_IP" | tr -dc ':' | wc -c)
        if [ "$_colons" -lt 5 ]; then
          _suffix=$(printf "%$((5 - _colons))s" | tr ' ' ':')
          info "parse-hcnmgr: applying static IP to $BONDNAME"
          NEW_ARGS="$NEW_ARGS ip=$HCN_IP${_suffix}$BONDNAME:none"
          CHANGED=1
        fi
        ;;
      esac
    fi
  fi

  # Process hcn.route
  if [ -n "$HCN_ROUTE" ]; then
    _matched=0
    for _s in $SLAVE_NAMES $SLAVE_MACS; do
      _s_dash=$(echo "$_s" | tr ':' '-')
      if echo ":$HCN_ROUTE:" | grep -qE ":($_s|$_s_dash):"; then
        _matched=1
        _current_hcn_route=$(echo "$HCN_ROUTE" | sed -E "s/^($_s|$_s_dash)([: ]|$)/$BONDNAME\2/; s/([: ])($_s|$_s_dash)([: ]|$)/\1$BONDNAME\3/g")
        NEW_ARGS="$NEW_ARGS rd.route=$_current_hcn_route"
        CHANGED=1
        break
      fi
    done
    if [ $_matched -eq 0 ] && ! echo "$HCN_ROUTE" | grep -q ":bond[0-9]"; then
      _colons=$(echo "$HCN_ROUTE" | tr -dc ':' | wc -c)
      if [ "$_colons" -le 1 ]; then
        info "parse-hcnmgr: applying route to $BONDNAME"
        NEW_ARGS="$NEW_ARGS rd.route=$HCN_ROUTE$([ "$_colons" -eq 0 ] && echo "::" || echo ":")$BONDNAME"
        CHANGED=1
      fi
    fi
  fi

  # Replace slaves in existing command line (ip= and rd.route=)
  for _s in $SLAVE_NAMES $SLAVE_MACS; do
    _s_dash=$(echo "$_s" | tr ':' '-')
    if echo "$MOD_CMDLINE" | grep -qE "$_s|$_s_dash"; then
      info "parse-hcnmgr: replacing slave $_s/$_s_dash with $BONDNAME in cmdline"
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed -E "s/([:=])($_s|$_s_dash)([: ]|$)/\1$BONDNAME\3/g")
      CHANGED=1
    fi
  done
done

# Write new configuration and update NetworkManager
if [ $CHANGED -eq 1 ] || [ -n "$NEW_ARGS" ]; then
  info "parse-hcnmgr: writing /etc/cmdline.d/99-hcnmgr.conf"
  mkdir -p /etc/cmdline.d
  echo "$NEW_ARGS" >/etc/cmdline.d/99-hcnmgr.conf

  export CMDLINE="$MOD_CMDLINE $NEW_ARGS"

  for _gen in /usr/lib/NetworkManager/nm-initrd-generator /usr/libexec/nm-initrd-generator; do
    if [ -x "$_gen" ]; then
      info "parse-hcnmgr: calling $_gen"
      "$_gen" -- $CMDLINE
      fixup_nm_connections
      mkdir -p /run/NetworkManager/initrd
      : >/run/NetworkManager/initrd/neednet
      break
    fi
  done
fi
