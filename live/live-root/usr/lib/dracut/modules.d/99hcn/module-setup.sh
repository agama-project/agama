#!/bin/bash
# SPDX-License-Identifier: GPL-2.0-or-later

check() {
    local _arch=${DRACUT_ARCH:-$(uname -m)}
    [[ "$_arch" = "ppc64" ]] || [[ "$_arch" = "ppc64le" ]] || return 1

    require_binaries hexdump ofpathname pseries_platform awk mkdir mv sed sleep tr || return 1

    return 255
}

depends() {
    echo network-manager
    return 0
}

install() {
    inst_multiple hexdump ofpathname pseries_platform awk mkdir mv sed sleep tr

    inst_script "$moddir/parse-hcn.sh" /usr/bin/parse-hcn
    inst_simple "$moddir/hcn-init-initrd.service" "${systemdsystemunitdir}/hcn-init-initrd.service"
    $SYSTEMCTL -q --root "$initdir" enable hcn-init-initrd.service
}
