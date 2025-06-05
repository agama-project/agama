#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
set -ex

# Agama driver updates
updates=$(getargs inst.dud=)
if [ -n "$updates" ]; then
  # make sure network comes up even if we're doing a local live device
  if [ -z "$netroot" ]; then
    echo >/tmp/net.ifaces
  fi
  echo "$updates" >/tmp/agamadud.info
  echo '[ -e /tmp/agama_dud.done ]'
fi
