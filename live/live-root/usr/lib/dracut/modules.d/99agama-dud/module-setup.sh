#!/bin/bash
# module-setup.sh for Agama Driver Updates

# called by dracut
check() {
  return 0
}

# called by dracut
depends() {
  echo network url-lib img-lib bash
  return 0
}

installkernel() {
  return 0
}

# called by dracut
install() {
  inst_multiple agama-transfer

  inst_hook cmdline 99 "$moddir/agama-dud-parser.sh"
  inst_hook pre-pivot 99 "$moddir/agama-dud-apply.sh"
}
