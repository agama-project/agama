#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

if [ -e /etc/cmdline.d/99-agama-cmdline.conf ]; then
  echo "Creating agama conf"
  mkdir -p "$NEWROOT/etc/agama.d"
  cp /etc/cmdline.d/99-agama-cmdline.conf "$NEWROOT/etc/agama.d/cmdline.conf"
fi
