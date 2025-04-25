#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

if [ -e /etc/hostname ]; then
  cp /etc/hostname "$NEWROOT/etc/hostname"
fi

if [ -e /run/agama/copy_network ]; then
  if getargbool 1 inst.copy_network; then
    mkdir -p /run/NetworkManager/conf.d
    echo '[main]' >/run/NetworkManager/conf.d/00-agama-server.conf
    echo 'no-auto-default=*' >>/run/NetworkManager/conf.d/00-agama-server.conf
    echo 'ignore-carrier=*' >>/run/NetworkManager/conf.d/00-agama-server.conf

    mkdir -p "$NEWROOT/etc/NetworkManager/system-connections/"
    cp /run/NetworkManager/system-connections/* "$NEWROOT/etc/NetworkManager/system-connections/"
  fi
fi
