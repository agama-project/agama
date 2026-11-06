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
  inst_multiple uname tee

  inst_simple "$moddir/initrd-kernel-check.service" "$systemdsystemunitdir/initrd-kernel-check.service"
  inst_simple "$moddir/initrd-rootfs-kernel-check.service" "$systemdsystemunitdir/initrd-rootfs-kernel-check.service"

  # display the saved errors again in the emergency shell: "sulogin -e" starts
  # a plain "sh" which reads only the file from $ENV, dracut-emergency sources
  # /etc/profile
  inst_simple "$moddir/bashrc" /root/.bashrc
  mkdir -p "$initdir/etc"
  {
    echo 'ENV=/root/.bashrc; export ENV'
    echo '[ -r /root/.bashrc ] && . /root/.bashrc'
  } >> "$initdir/etc/profile"

  # make sure the services are started in the initramfs, the initrd check runs
  # early in the boot, the root image check runs after /sysroot is mounted
  $SYSTEMCTL -q --root "$initdir" add-wants sysinit.target initrd-kernel-check.service
  $SYSTEMCTL -q --root "$initdir" add-wants initrd.target initrd-rootfs-kernel-check.service
  set +e
}
