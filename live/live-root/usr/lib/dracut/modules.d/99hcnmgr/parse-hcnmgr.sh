#!/bin/sh

type getargs >/dev/null 2>&1 || . /lib/dracut-lib.sh

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

get_dev_hcn() {
  local _dev=$1
  local _hcnid
  local _devname
  local _mac

  _hcnid=$(xdump4 "$_dev"/ibm,hcn-id)
  if [ -z "$_hcnid" ]; then
    return 1
  fi

  # Get the device name using ofpathname
  _devname=$(ofpathname -l "$(echo "$_dev" | sed -e "s/\/proc\/device-tree//")" 2>/dev/null)
  _mac=$(get_mac "$_dev")

  if [ -n "$_devname" ]; then
    echo "bond$_hcnid $_devname $_mac"
    return 0
  fi
  return 1
}

# Collect all mappings
MAPPINGS=""
if [ -d /proc/device-tree ]; then
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
fi

if [ -z "$MAPPINGS" ]; then
  # Use return if sourced (like in a dracut hook), or exit if executed directly
  [ "$0" = "/init" ] || [ "$0" = "/lib/dracut/dracut-initqueue.sh" ] && return 0 || exit 0
fi

# We might not have CMDLINE variable exported if it's an older dracut, so let's check
if [ -z "$CMDLINE" ]; then
  [ -r /proc/cmdline ] && CMDLINE=$(cat /proc/cmdline)
fi

HNV_IP=$(getargs hnv.ip)
[ -z "$HNV_IP" ] && HNV_IP=$(getargs hvn.ip)

NEW_ARGS=""
MOD_CMDLINE="$CMDLINE"
CHANGED=0

# Unique bond names
BOND_NAMES=$(echo "$MAPPINGS" | awk '{print $1}' | sort -u)

for BONDNAME in $BOND_NAMES; do
  SLAVES=""
  SLAVE_NAMES=""
  SLAVE_MACS=""

  # Extract slaves for this bond
  set -- $MAPPINGS
  while [ $# -ge 3 ]; do
    if [ "$1" = "$BONDNAME" ]; then
      SLAVE_NAMES="$SLAVE_NAMES $2"
      [ -n "$3" ] && SLAVE_MACS="$SLAVE_MACS $3"
      if [ -z "$SLAVES" ]; then
        SLAVES="$2"
      else
        SLAVES="$SLAVES,$2"
      fi
    fi
    shift 3
  done

  # Add bond definition
  NEW_ARGS="$NEW_ARGS bond=$BONDNAME:$SLAVES:mode=1,miimon=100,fail_over_mac=2"

  if [ -n "$HNV_IP" ]; then
    MATCHED=0
    CURRENT_HNV_IP="$HNV_IP"

    # Check if HNV_IP matches any slave of THIS bond (name or MAC)
    for s in $SLAVE_NAMES $SLAVE_MACS; do
      [ -z "$s" ] && continue
      s_dash=$(echo "$s" | tr ':' '-')
      if [ "$HNV_IP" = "$s" ] || [ "$HNV_IP" = "$s_dash" ]; then
        CURRENT_HNV_IP="$BONDNAME"
        MATCHED=1
        break
      elif echo "$HNV_IP" | grep -q ":$s\(:\|$\)"; then
        CURRENT_HNV_IP=$(echo "$HNV_IP" | sed "s/:$s\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      elif echo "$HNV_IP" | grep -q ":$s_dash\(:\|$\)"; then
        CURRENT_HNV_IP=$(echo "$HNV_IP" | sed "s/:$s_dash\(:\|$\)/:$BONDNAME\1/")
        MATCHED=1
        break
      fi
    done

    if [ $MATCHED -eq 1 ]; then
      NEW_ARGS="$NEW_ARGS ip=$CURRENT_HNV_IP"
      CHANGED=1
    else
      # Fallback if it doesn't match any specific bond but is just an IP
      if ! echo "$HNV_IP" | grep -q ":bond[0-9]"; then
        COLONS=$(echo "$HNV_IP" | tr -dc ':' | wc -c)
        if [ "$COLONS" -eq 0 ]; then
          NEW_ARGS="$NEW_ARGS ip=$HNV_IP:::::$BONDNAME:none"
          CHANGED=1
        fi
      fi
    fi
  fi

  # Replace slaves in existing ip= arguments
  for slave in $SLAVE_NAMES; do
    if echo "$MOD_CMDLINE" | grep -q "$slave"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$slave\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
  done
  for mac in $SLAVE_MACS; do
    mac_dash=$(echo "$mac" | tr ':' '-')
    if echo "$MOD_CMDLINE" | grep -q "$mac"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$mac\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
    if echo "$MOD_CMDLINE" | grep -q "$mac_dash"; then
      MOD_CMDLINE=$(echo "$MOD_CMDLINE" | sed "s/\(ip=[^ ]*[:=]\)$mac_dash\([: ]\|$\)/\1$BONDNAME\2/g")
      CHANGED=1
    fi
  done
done

if [ $CHANGED -eq 1 ] || [ -n "$NEW_ARGS" ]; then
  # Write to cmdline.d
  echo "$NEW_ARGS" >/etc/cmdline.d/99-hcnmgr.conf

  # Update global CMDLINE
  export CMDLINE="$MOD_CMDLINE $NEW_ARGS"

  # Call nm-initrd-generator
  for generator in /usr/lib/NetworkManager/nm-initrd-generator /usr/libexec/nm-initrd-generator; do
    if [ -x "$generator" ]; then
      $generator -- $CMDLINE
      break
    fi
  done
fi
