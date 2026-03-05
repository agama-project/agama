#!/bin/sh

type getargs >/dev/null 2>&1 || . /lib/dracut-lib.sh

info "parse-hcnmgr: starting"

xdump4() {
  hexdump -n 4 -ve '/1 "%02x"' "$1"
}

get_mac() {
  local _dev=$1
  local _mac
  if [ -f "$_dev/local-mac-address" ]; then
    _mac=$(hexdump -ve '/1 "%02x:"' "$_dev/local-mac-address")
    echo "${_mac%:}"
  fi
}

#
# function get_dev_hcn
#	Given device path, Search for device-tree, get HCNID,
#	device name, and mode to configure/delete/query device
#	or active-backup bonding
#
# $1 path to device-tree device
#
get_dev_hcn() {
  local _dev=$1
  local _hcnid
  local _devname
  local _mode
  local _mac
  local _wait=12

  _hcnid=$(xdump4 "$_dev"/ibm,hcn-id)
  if [ -z "$_hcnid" ]; then
    return 1
  fi

  _mode=$(tr -d '\0' <"$_dev"/ibm,hcn-mode 2>/dev/null)

  # Get the device name. After migration, it may take some time for
  # sysfs interface up or OFPATHENAME command to translate to device name.
  # Let's retry a few times.
  while [ $_wait -ne 0 ]; do
    local _ofpath=$(echo "$_dev" | sed -e "s/^\/proc\/device-tree//")
    if _devname=$(ofpathname -l "$_ofpath" 2>/dev/null); then
      if [ -e "/sys/class/net/$_devname" ]; then
        info "ofpathname waiting for /sys/class/net device $_devname ready"
        _mac=$(get_mac "$_dev")
        break
      fi
    fi

    info "ofpathname return $?, devname is $_devname, and the retry counter $_wait"
    sleep 15
    _wait=$((_wait - 1))
  done

  if [ -z "$_devname" ]; then
    warn "get_dev_hcn: couldn't get dev name for $_dev"
    return 1
  fi

  # Output the bond mapping: bondname devname mac mode
  echo "bond$_hcnid $_devname ${_mac:-none} ${_mode:-none}"
  return 0
}

# Collect all mappings
MAPPINGS=""
if [ -d /proc/device-tree ]; then
  # PCI devices (SR-IOV)
  for pci_dev in /proc/device-tree/pci*; do
    [ -d "$pci_dev" ] || continue
    for dev in "$pci_dev"/ethernet*; do
      [ -d "$dev" ] || continue
      if [ -e "$dev"/ibm,hcn-id ]; then
        res=$(get_dev_hcn "$dev")
        if [ -n "$res" ]; then
          MAPPINGS="$MAPPINGS $res"
        fi
      fi
    done
  done

  # vdevices (VNIC and Virtual Ethernet)
  if [ -d /proc/device-tree/vdevice ]; then
    for dev in /proc/device-tree/vdevice/vnic* /proc/device-tree/vdevice/l-lan*; do
      [ -d "$dev" ] || continue
      if [ -e "$dev"/ibm,hcn-id ]; then
        res=$(get_dev_hcn "$dev")
        if [ -n "$res" ]; then
          MAPPINGS="$MAPPINGS $res"
        fi
      fi
    done
  fi
fi

if [ -z "$MAPPINGS" ]; then
  info "parse-hcnmgr: no mappings found"
  # Use return if sourced (like in a dracut hook), or exit if executed directly
  [ "$0" = "/init" ] || [ "$0" = "/lib/dracut/dracut-initqueue.sh" ] && return 0 || exit 0
fi

info "parse-hcnmgr: mappings found:$MAPPINGS"

# We might not have CMDLINE variable exported if it's an older dracut, so let's check
if [ -z "$CMDLINE" ]; then
  [ -r /proc/cmdline ] && CMDLINE=$(cat /proc/cmdline)
fi

HCN_IP=$(getargs hcn.ip)
[ -z "$HCN_IP" ] && HCN_IP=$(getargs hvn.ip)

HCN_ROUTE=$(getargs hcn.route)
[ -z "$HCN_ROUTE" ] && HCN_ROUTE=$(getargs hvn.route)

info "parse-hcnmgr: HCN_IP=$HCN_IP HCN_ROUTE=$HCN_ROUTE"

NEW_ARGS=""
MOD_CMDLINE="$CMDLINE"
CHANGED=0

# Unique bond names
BOND_NAMES=$(echo "$MAPPINGS" | awk '{print $1}' | sort -u)

for BONDNAME in $BOND_NAMES; do
  SLAVES=""
  SLAVE_NAMES=""
  SLAVE_MACS=""
  PRIMARY=""

  # Extract slaves for this bond
  set -- $MAPPINGS
  while [ $# -ge 4 ]; do
    if [ "$1" = "$BONDNAME" ]; then
      _s_name=$2
      _s_mac=$3
      _s_mode=$4

      SLAVE_NAMES="$SLAVE_NAMES $_s_name"
      [ "$_s_mac" != "none" ] && SLAVE_MACS="$SLAVE_MACS $_s_mac"
      [ "$_s_mode" = "primary" ] && PRIMARY="$_s_name"

      if [ -z "$SLAVES" ]; then
        SLAVES="$_s_name"
      else
        SLAVES="$SLAVES,$_s_name"
      fi
    fi
    shift 4
  done

  # Add bond definition
  BOND_OPTS="mode=1,miimon=100,fail_over_mac=2"
  [ -n "$PRIMARY" ] && BOND_OPTS="$BOND_OPTS,primary=$PRIMARY"

  NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:$BOND_OPTS"

  if [ -n "$HCN_IP" ]; then
    MATCHED=0
    CURRENT_HCN_IP="$HCN_IP"

    # Check if HCN_IP matches any slave of THIS bond (name or MAC)
    for s in $SLAVE_NAMES $SLAVE_MACS; do
      [ -z "$s" ] && continue
      s_dash=$(echo "$s" | tr ':' '-')
      if [ "$HCN_IP" = "$s" ] || [ "$HCN_IP" = "$s_dash" ]; then
        CURRENT_HCN_IP="$BONDNAME"
        MATCHED=1
        break
      elif echo "$HCN_IP" | grep -q ":$s\(:\|$\)"; then
        CURRENT_HCN_IP=$(echo "$HCN_IP" | sed "s/:$s\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      elif echo "$HCN_IP" | grep -q ":$s_dash\(:\|$\)"; then
        CURRENT_HCN_IP=$(echo "$HCN_IP" | sed "s/:$s_dash\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      fi
    done

    if [ $MATCHED -eq 1 ]; then
      NEW_ARGS="$NEW_ARGS ip=$CURRENT_HCN_IP"
      CHANGED=1
    else
      # Fallback if it doesn't match any specific bond but is just an IP
      if ! echo "$HCN_IP" | grep -q ":bond[0-9]"; then
        COLONS=$(echo "$HCN_IP" | tr -dc ':' | wc -c)
        if [ "$COLONS" -eq 0 ]; then
          NEW_ARGS="$NEW_ARGS ip=$HCN_IP:::::$BONDNAME:none"
          CHANGED=1
        fi
      fi
    fi
  fi

  if [ -n "$HCN_ROUTE" ]; then
    MATCHED=0
    CURRENT_HCN_ROUTE="$HCN_ROUTE"

    # Check if HCN_ROUTE matches any slave of THIS bond (name or MAC)
    for s in $SLAVE_NAMES $SLAVE_MACS; do
      [ -z "$s" ] && continue
      s_dash=$(echo "$s" | tr ':' '-')
      if [ "$HCN_ROUTE" = "$s" ] || [ "$HCN_ROUTE" = "$s_dash" ]; then
        CURRENT_HCN_ROUTE="$BONDNAME"
        MATCHED=1
        break
      elif echo "$HCN_ROUTE" | grep -q ":$s\(:\|$\)"; then
        CURRENT_HCN_ROUTE=$(echo "$HCN_ROUTE" | sed "s/:$s\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      elif echo "$HCN_ROUTE" | grep -q ":$s_dash\(:\|$\)"; then
        CURRENT_HCN_ROUTE=$(echo "$HCN_ROUTE" | sed "s/:$s_dash\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      fi
    done

    if [ $MATCHED -eq 1 ]; then
      NEW_ARGS="$NEW_ARGS rd.route=$CURRENT_HCN_ROUTE"
      CHANGED=1
    else
      # Fallback if it doesn't match any specific bond but is just a route spec without interface
      if ! echo "$HCN_ROUTE" | grep -q ":bond[0-9]"; then
        COLONS=$(echo "$HCN_ROUTE" | tr -dc ':' | wc -c)
        if [ "$COLONS" -eq 0 ]; then
          NEW_ARGS="$NEW_ARGS rd.route=$HCN_ROUTE::$BONDNAME"
          CHANGED=1
        elif [ "$COLONS" -eq 1 ]; then
          NEW_ARGS="$NEW_ARGS rd.route=$HCN_ROUTE:$BONDNAME"
          CHANGED=1
        fi
      fi
    fi
  fi

  # Replace slaves in existing ip= and rd.route= arguments
  for slave in $SLAVE_NAMES; do
    if echo "$MOD_CMDLINE" | grep -q "$slave"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$slave\([: ]\|$\)/\1$BONDNAME\2/g")
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(rd.route=[^ ]*[:=]\)$slave\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
  done
  for mac in $SLAVE_MACS; do
    mac_dash=$(echo "$mac" | tr ':' '-')
    if echo "$MOD_CMDLINE" | grep -q "$mac"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$mac\([: ]\|$\)/\1$BONDNAME\2/g")
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(rd.route=[^ ]*[:=]\)$mac\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
    if echo "$MOD_CMDLINE" | grep -q "$mac_dash"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$mac_dash\([: ]\|$\)/\1$BONDNAME\2/g")
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(rd.route=[^ ]*[:=]\)$mac_dash\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
  done
done

if [ $CHANGED -eq 1 ] || [ -n "$NEW_ARGS" ]; then
  info "parse-hcnmgr: writing /etc/cmdline.d/99-hcnmgr.conf with $NEW_ARGS"
  # Write to cmdline.d
  mkdir -p /etc/cmdline.d
  echo "$NEW_ARGS" >/etc/cmdline.d/99-hcnmgr.conf

  # Update global CMDLINE
  export CMDLINE="$MOD_CMDLINE $NEW_ARGS"

  # Call nm-initrd-generator
  for generator in /usr/lib/NetworkManager/nm-initrd-generator /usr/libexec/nm-initrd-generator; do
    if [ -x "$generator" ]; then
      info "parse-hcnmgr: calling $generator"
      $generator -- $CMDLINE
      mkdir -p /run/NetworkManager/initrd
      : >/run/NetworkManager/initrd/neednet
      break
    fi
  done

fi
