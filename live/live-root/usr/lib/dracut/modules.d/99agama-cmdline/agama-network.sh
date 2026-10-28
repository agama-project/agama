#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/net-lib.sh

if getargs ip= >/dev/null || getargs rd.hcn.ip= >/dev/null || getargs rd.hcn.route= >/dev/null; then
  mkdir -p /run/agama/
  : >/run/agama/custom_dracut_network
fi
