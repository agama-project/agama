#!/bin/bash

# HCN (Hybrid Cloud Network) dracut module setup

# called by dracut
check() {
  # Only support PowerPC architectures
  local _arch=${DRACUT_ARCH:-$(uname -m)}
  [ "$_arch" = "ppc64" ] || [ "$_arch" = "ppc64le" ] || return 1

  require_binaries hexdump ofpathname pseries_platform || return 1
  return 255
}

# called by dracut
depends() {
  # This module depends on network-manager support
  echo "network-manager"
}

# called by dracut
install() {
  # Required binaries for discovery and configuration
  inst_multiple hcnmgr hexdump ofpathname pseries_platform awk sed

  if dracut_module_included "systemd"; then
    # Install as a systemd service to run before NetworkManager
    inst_simple "$moddir/parse-hcnmgr.sh" "/usr/bin/parse-hcnmgr.sh"
    inst_simple "$moddir/hcnmgr-initrd.service" "${systemdsystemunitdir}/hcnmgr-initrd.service"
    $SYSTEMCTL -q --root "$initdir" enable hcnmgr-initrd.service
  else
    # Install as an initqueue hook for non-systemd environments
    inst_hook initqueue 01 "$moddir/parse-hcnmgr.sh"
  fi

  # Bypass standard NetworkManager initrd configuration generator so that 99hcnmgr can take over
  # This prevents conflicts when rd.hcn=1 is used with standard ip= parameters
  local bypassed=0
  if [[ -e "${initdir}/var/lib/dracut/hooks/cmdline/99-nm-config.sh" ]]; then
    sed -i 's#nm_generate_connections#:#g' "${initdir}/var/lib/dracut/hooks/cmdline/99-nm-config.sh" && bypassed=$((bypassed + 1))
  fi
  if [[ -e "${initdir}/usr/lib/systemd/system/NetworkManager-config-initrd.service" ]]; then
    sed -i 's#/usr/libexec/nm-initrd-generator#:#g' "${initdir}/usr/lib/systemd/system/NetworkManager-config-initrd.service" && bypassed=$((bypassed + 1))
  fi
  if [[ -e "${initdir}/usr/lib/systemd/system/NetworkManager-config-initrd.service.d/NetworkManager-config-initrd-dracut.conf" ]]; then
    sed -i -E 's#/usr/lib(exec)?/nm-initrd-generator -- \$\(getcmdline\)#:#g' "${initdir}/usr/lib/systemd/system/NetworkManager-config-initrd.service.d/NetworkManager-config-initrd-dracut.conf" && bypassed=$((bypassed + 1))
  fi
  [[ $bypassed -eq 0 ]] && dwarn "hcnmgr: Could not bypass any NetworkManager generator hooks - this may cause conflicts"
}
