#!/bin/bash
# module-setup.sh for checking that the initrd matches the booted kernel
# see https://www.man7.org/linux/man-pages/man7/dracut.modules.7.html

# called by dracut
check() {
  # always include this dracut module in the initramfs
  return 0
}

# called by dracut
depends() {
  # dracut-systemd provides the emergency shell service
  echo dracut-systemd
  return 0
}

installkernel() {
  return 0
}

# install hook for dracut
install() {
  # fail if any install command fails (cannot be used globally as this file is sourced by dracut)
  set -e

  inst_script "$moddir/initrd-kernel-check.sh" /bin/initrd-kernel-check
  inst_multiple uname

  inst_simple "$moddir/initrd-kernel-check.service" "$systemdsystemunitdir/initrd-kernel-check.service"

  # make sure the service is started in the initramfs
  $SYSTEMCTL -q --root "$initdir" add-wants sysinit.target initrd-kernel-check.service
  set +e
}
