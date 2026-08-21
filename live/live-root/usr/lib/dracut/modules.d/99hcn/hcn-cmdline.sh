#!/bin/sh

# HCN (Hybrid Cloud Network) dracut module - kernel command line hook
#
# Announces that HCN takes care of the network configuration by writing an
# "ip=hcn" marker to /etc/cmdline.d. The configuration itself is done much
# later by parse-hcn, which has to wait for udev to discover the devices.
#
# The marker is internal, users still request HCN with rd.hcn.ip/rd.hcn.route.
# Writing it by hand does not enable HCN, it only keeps the others away.
#
# The marker keeps everybody else away from the HCN bond ports:
#
#   * nm-initrd-generator skips the argument and, more importantly, does not
#     fabricate its default DHCP connection when rd.neednet=1 is set but the
#     command line produced no connection (PED-14534). That default would bring
#     the bond ports up independently, breaking the bond.
#   * The other Agama modules (99agama-dud, 99live-self-update, 99initrd-nmtui)
#     only add "ip=dhcp" when the user did not configure the network, so an
#     "ip=" of any kind is enough for them to keep their hands off. This hook
#     therefore has to run before them, see the priority in module-setup.sh.
#
# Two requirements are worth keeping in mind:
#
#   * NetworkManager needs "ip=hcn" support (PED-14534). Older versions treat it
#     as an unknown method and generate their default wired DHCP connection.
#   * The early generation has to read the dracut command line and not just
#     /proc/cmdline. That is the case in a dracut initrd, where the
#     35network-manager module installs a drop-in for
#     NetworkManager-config-initrd.service replacing "cat /proc/cmdline" with
#     the "getcmdline" dracut function.

command -v getargbool >/dev/null || . /lib/dracut-lib.sh

# Device tree location and generated configuration file. Only overridden by the
# test suite.
HCN_DEVICE_TREE="${HCN_DEVICE_TREE:-/proc/device-tree}"
HCN_CMDLINE_FILE="${HCN_CMDLINE_FILE:-/etc/cmdline.d/20-hcn.conf}"

# Whether the HCN configuration was requested through the kernel command line.
# Mirrors the conditions of hcn-init-initrd.service.
hcn_requested() {
  # rd.hcn=0 disables HCN even when other HCN options are present
  getargbool 1 rd.hcn || return 1

  getargbool 0 rd.hcn && return 0
  getarg rd.hcn.ip= >/dev/null && return 0
  getarg rd.hcn.route= >/dev/null && return 0

  return 1
}

# Whether the device tree contains any HCN device. Unlike parse-hcn, this does
# not wait for the devices to show up in sysfs, it only checks whether there is
# something to be configured at all.
hcn_devices_present() {
  local dev

  for dev in "$HCN_DEVICE_TREE"/pci*/ethernet* \
    "$HCN_DEVICE_TREE"/vdevice/vnic* "$HCN_DEVICE_TREE"/vdevice/l-lan*; do
    [ -e "$dev/ibm,hcn-id" ] && return 0
  done

  return 1
}

hcn_write_cmdline() {
  hcn_requested || return 0

  # Without HCN devices parse-hcn does not configure anything, so do not claim
  # the network configuration and let the other modules set it up as usual.
  if ! hcn_devices_present; then
    info "hcn-cmdline: HCN requested but no HCN device found in the device tree"
    return 0
  fi

  info "hcn-cmdline: HCN takes care of the network configuration, writing 'ip=hcn'"
  echo "ip=hcn" > "$HCN_CMDLINE_FILE"
}

hcn_write_cmdline
