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
  inst_hook cmdline 99 "$moddir/agama-dud-parser.sh"
  # Fetch and apply the updates in the pre-pivot hook in order to use some binaries and scripts
  # from the installer img using a chroot (also from the image itself).
  inst_hook pre-pivot 99 "$moddir/agama-dud-apply.sh"
}
