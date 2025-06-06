#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

fetch_updates() {
  # Agama driver updates
  local updates
  updates=$(getargs inst.dud=)
  if [ -n "$updates" ]; then
    echo "$updates" >/tmp/agamadud.info
  fi
}

fetch_updates
