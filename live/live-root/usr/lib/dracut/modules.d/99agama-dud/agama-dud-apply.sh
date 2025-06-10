#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/img-lib.sh

DUD_DIR="/run/agama/dud"
ROOT="/sysroot"
AGAMA_CLI="$ROOT/usr/bin/agama"

apply_updates() {
  local file
  local dud_url

  while read -r dud_url; do
    mkdir -p "$ROOT/$DUD_DIR"
    file=${dud_url##*/}
    echo "Fetching a Driver Update Disk from $dud_url to $file"
    if ! $AGAMA_CLI download $dud_url "$ROOT/$DUD_DIR/$file"; then
      warn "Failed to fetch the Driver Update Disk"
      exit 1
    fi
    mkdir -p "$ROOT/$DUD_DIR/${file}_unpacked"
    echo "Unpacking ${file}"
    unpack_img "$ROOT/$DUD_DIR/$file" "$ROOT/$DUD_DIR/${file}_unpacked"
    apply_update "$ROOT/$DUD_DIR/${file}_unpacked"
  done </tmp/agamadud.info

  for dud in $ROOT/$DUD_DIR/*; do
    echo $dud
  done
}

apply_update() {
  dud_dir=$1
  echo "Apply update from ${dud_dir}"

  dud_root=$(echo $dud_dir/linux/suse/$(uname -m)-*)
  echo "Detected DUD root at ${dud_root}"

  for rpm in "${dud_root}/install/*.rpm"; do
    $ROOT/usr/bin/chroot $ROOT /usr/bin/rpm -Uvh --nodeps --force "${rpm#$ROOT}"
  done

  cp -av "${dud_root}/inst-sys/"* $ROOT
}

apply_updates
