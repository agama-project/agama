#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/net-lib.sh

if _val=$(getargs ip=); then
  mkdir -p /run/agama/
  : >/run/agama/copy_network
fi
