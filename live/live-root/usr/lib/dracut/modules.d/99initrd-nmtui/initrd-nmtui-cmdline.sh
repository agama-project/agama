#!/bin/bash

# automatically configure network and start NetworkManager when live.net_config_tui=1

. /lib/dracut-lib.sh

# generate Dracut command line options
FILE="/etc/cmdline.d/initrd-nmtui.conf"

# only if interactive network config requested
if getargbool 0 live.net_config_tui; then
  # and network not disabled
  if getargbool 1 rd.neednet; then
    echo "rd.neednet=1" >"$FILE"
    # use DHCP if there is no network configuration provided by user
    if ! getarg "ip="; then
      echo "ip=dhcp" >>"$FILE"
    fi
  fi
fi
