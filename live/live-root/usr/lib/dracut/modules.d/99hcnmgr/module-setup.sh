#!/bin/bash

# called by dracut
check() {
  # Only support ppc64/ppc64le
  local _arch
  _arch=$(uname -m)
  [ "$_arch" = "ppc64" ] || [ "$_arch" = "ppc64le" ] || return 1
  require_binaries hexdump ofpathname pseries_platform || return 1
  return 0
}

# called by dracut
depends() {
  echo "network"
}

# called by dracut
install() {
  inst_multiple hcnmgr hexdump ofpathname pseries_platform awk sort wc tr sed grep cat
  if dracut_module_included "systemd"; then
    inst_simple "$moddir/parse-hcnmgr.sh" "/usr/bin/parse-hcnmgr.sh"
    inst_simple "$moddir/hcnmgr-initrd.service" "${systemdsystemunitdir}/hcnmgr-initrd.service"
    mkdir -p "${initdir}${systemdsystemunitdir}/initrd.target.wants"
    ln_s "../hcnmgr-initrd.service" "${systemdsystemunitdir}/initrd.target.wants/hcnmgr-initrd.service"
  else
    inst_hook initqueue 01 "$moddir/parse-hcnmgr.sh"
  fi
}
