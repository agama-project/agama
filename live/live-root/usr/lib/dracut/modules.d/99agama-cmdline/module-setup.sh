#!/bin/bash

# called by dracut
check() {
  return 0
}

# called by dracut
depends() {
  return 0
}

installkernel() {
  return 0
}

# called by dracut
install() {
  inst_hook cmdline 99 "$moddir/agama-cmdline-conf.sh"
  inst_hook cmdline 99 "$moddir/agama-network-compat.sh"
  inst_hook cmdline 99 "$moddir/agama-network.sh"
  inst_hook pre-pivot 99 "$moddir/save-agama-conf.sh"
}
