#!/bin/bash

# called by dracut
check() {
  # Only support ppc64/ppc64le
  local _arch
  _arch=${DRACUT_ARCH:-$(uname -m)}
  [ "$_arch" = "ppc64" ] || [ "$_arch" = "ppc64le" ] || return 1
  # pseries_platform is required by ofpathname
  require_binaries hexdump ofpathname pseries_platform || return 1
  return 0
}

# called by dracut
depends() {
  echo "systemd network-manager"
}

# called by dracut
install() {
  inst_multiple awk sort wc tr sed
  inst_simple "$moddir/parse-hcnmgr.sh" "/usr/bin/parse-hcnmgr.sh"
  inst_simple "$moddir/hcnmgr-initrd.service" "${systemdsystemunitdir}/hcnmgr-initrd.service"
  $SYSTEMCTL -q --root "$initdir" enable hcnmgr-initrd.service
}
