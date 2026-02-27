#!/bin/bash

# called by dracut
check() {
  # Only support ppc64/ppc64le
  local _arch
  _arch=$(uname -m)
  [ "$_arch" = "ppc64" ] || [ "$_arch" = "ppc64le" ] || return 1
  require_binaries hexdump ofpathname || return 1
  return 0
}

# called by dracut
depends() {
  echo "network"
}

# called by dracut
install() {
  inst_multiple hexdump ofpathname
  #    inst_hook initqueue/settled 30 "$moddir/parse-hcnmgr.sh"
  inst_hook cmdline 30 "$moddir/parse-hcnmgr.sh"
}
