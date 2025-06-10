#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/img-lib.sh

DUD_DIR="/run/agama/dud"

apply_updates() {
  local file
  local dud_url

  while read -r dud_url; do
    mkdir -p "$DUD_DIR"
    echo "Fetching $dud_url!"
    file=${dud_url##*/}
    if ! agama-transfer $dud_url "$DUD_DIR/$file"; then
      warn "failed to fetch DUD!"
      exit 1
    fi
    mkdir -p "$DUD_DIR/${file}_unpacked"
    echo "Unpacking ${file}"
    unpack_img "$DUD_DIR/$file" "$DUD_DIR/${file}_unpacked"
  done </tmp/agamadud.info

  for dud in $DUD_DIR/*; do
    echo $dud
  done
}

apply_updates
