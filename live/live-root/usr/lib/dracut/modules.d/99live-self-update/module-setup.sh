#!/bin/bash
# module-setup.sh for Agama self-update
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
  # install the hook for processing the boot parameters
  inst_hook cmdline 99 "$moddir/live-self-update-parser.sh"

  # needed by the live-self-update-parser.sh script
  inst_multiple systemd-cat dirname

  # install the systemd service and the self-update script to the initramfs
  inst_multiple "$systemdsystemconfdir"/live-self-update.service live-self-update

  # enable the self-update service in the initramfs
  $SYSTEMCTL -q --root "$initdir" enable live-self-update.service
}
