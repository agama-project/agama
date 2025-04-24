#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

if [ -e /etc/hostname ]; then
  cp /etc/hostname "$NEWROOT/etc/hostname"
fi
