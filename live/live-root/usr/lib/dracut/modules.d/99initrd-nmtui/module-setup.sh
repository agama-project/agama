#!/bin/bash
# module-setup.sh for NetworkManger TUI configuration
# see https://www.man7.org/linux/man-pages/man7/dracut.modules.7.html

# called by dracut
check() {
  # always include this dracut module in the initramfs
  return 0
}

# called by dracut
depends() {
  echo network
  return 0
}

installkernel() {
  return 0
}

# install hook for dracut
install() {
  # fail if any install command fails (cannot be used globally as this file is sourced by dracut)
  set -e
  # install the hook for processing the boot parameters and enabling network support in dracut
  inst_hook cmdline 99 "$moddir/initrd-nmtui-cmdline.sh"

  # install the systemd service and the self-update script to the initramfs
  inst_multiple /etc/systemd/system/initrd-nmtui.service initrd-network-setup.sh dialog nmtui nmcli kill tput clear

  # enable the self-update service in the initramfs
  $SYSTEMCTL -q --root "$initdir" enable initrd-nmtui.service
  set +e
}
