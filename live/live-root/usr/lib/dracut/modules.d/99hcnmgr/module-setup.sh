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
  inst_multiple hcnmgr hexdump ofpathname pseries_platform
  #    inst_hook initqueue/settled 30 "$moddir/parse-hcnmgr.sh"
  inst_hook initqueue/settled 30 "$moddir/parse-hcnmgr.sh"
}
