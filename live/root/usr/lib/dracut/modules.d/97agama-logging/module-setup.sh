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
  inst_hook cmdline 97 "$moddir/agama-logging.sh"
}
