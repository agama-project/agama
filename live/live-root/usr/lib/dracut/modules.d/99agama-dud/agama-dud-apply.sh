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

    dud_root=$(echo $ROOT/$DUD_DIR/${file}_unpacked/linux/suse/$(uname -m)-*)
    echo "Detected DUD root at ${dud_root}"

    apply_update "$dud_root"
    copy_packages "$dud_root"
  done </tmp/agamadud.info

  create_repo "$ROOT/$DUD_DIR/repo"
}

# Apply an update to the inst-sys
apply_update() {
  dud_dir=$1
  echo "Apply inst-sys update from ${dud_dir}"

  cp -a "${dud_dir}/inst-sys/"* $ROOT

  dud_instsys="${dud_dir}/inst-sys"

  set_alternative $dud_instsys "agama-autoyast"
  set_alternative $dud_instsys "agamactl"
  set_alternative $dud_instsys "agama-proxy-setup"
}

# Sets the alternative links.
set_alternative() {
  dud_instsys=$1
  name=$2

  executables=("$dud_instsys/usr/bin/${name}.ruby"*-*)
  executable=${executables[0]}
  $ROOT/usr/bin/chroot $ROOT /usr/sbin/update-alternatives --install /usr/bin/$name $name ${executable##$dud_instsys} 250000
  $ROOT/usr/bin/chroot $ROOT /usr/sbin/update-alternatives --set $name ${executable##$dud_instsys}
}

# Copy the packages to use during installation
#
# This function is mainly a PoC.
#
# This is a simplistic version that just copies all the RPMs to the new repository.
# In the future, it might need to put each package under a different respository depending
# on the distribution (e.g., "/run/agama/dud/repo/tw" for "x86_64-tw").
copy_packages() {
  dud_dir=$1
  echo "Copy packages from ${dud_dir}"

  for rpm in "${dud_dir}/install/*.rpm"; do
    mkdir -p "$ROOT/$DUD_DIR/repo"
    cp $rpm "$ROOT/$DUD_DIR/repo"
  done
}

# Creates the repository metadata.
create_repo() {
  repo_dir=$1

  $ROOT/usr/bin/chroot $ROOT createrepo_c ${repo_dir##$ROOT}
}

apply_updates
