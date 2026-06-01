#!/bin/bash

# HCN (Hybrid Cloud Network) dracut module setup

# called by dracut
check() {
  # Only support PowerPC architectures
  local _arch
  _arch=$(uname -m)
  [ "$_arch" = "ppc64" ] || [ "$_arch" = "ppc64le" ] || return 1

  require_binaries hexdump ofpathname pseries_platform || return 1
  return 0
}

# called by dracut
depends() {
  # This module depends on network support
  echo "network"
}

# called by dracut
install() {
  # Required binaries for discovery and configuration
  inst_multiple hcnmgr hexdump ofpathname pseries_platform awk sort wc tr sed grep cat head

  if dracut_module_included "systemd"; then
    # Install as a systemd service to run before NetworkManager
    inst_simple "$moddir/parse-hcnmgr.sh" "/usr/bin/parse-hcnmgr.sh"
    inst_simple "$moddir/hcnmgr-initrd.service" "${systemdsystemunitdir}/hcnmgr-initrd.service"
    $SYSTEMCTL -q --root "$initdir" enable hcnmgr-initrd.service
  else
    # Install as an initqueue hook for non-systemd environments
    inst_hook initqueue 01 "$moddir/parse-hcnmgr.sh"
  fi
}
