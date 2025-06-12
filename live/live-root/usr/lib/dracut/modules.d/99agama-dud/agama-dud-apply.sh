#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/img-lib.sh

DUD_DIR="/run/agama/dud"
AGAMA_CLI="$NEWROOT/usr/bin/agama"
AGAMA_DUD_INFO="/tmp/agamadud.info"
DUD_RPM_REPOSITORY="$NEWROOT/var/lib/agama/dud/repo"

# Apply all the updates.
#
# Read the URL of the updates from $AGAMA_DUD_INFO and process each one:
#
#   1. Download and unpack the update in $DUD_DIR.
#   2. Copy the inst-sys updates to the $NEWROOT system.
#   3. Update agamactl, agama-autoyast and agama-proxy-setup alternative links.
#   4. Copy the packages to the $DUD_RPM_REPOSITORY.
apply_updates() {
  local file
  local dud_url
  index=0

  while read -r dud_url; do
    mkdir -p "$DUD_DIR"
    file=${dud_url##*/}
    # FIXME: use an index because two updates, coming from different places, can have the same name.
    echo "Fetching a Driver Update Disk from $dud_url to $file"
    if ! $AGAMA_CLI download "$dud_url" "$DUD_DIR/$file"; then
      warn "Failed to fetch the Driver Update Disk"
      exit 1
    fi

    dir="$DUD_DIR/dud_$(printf "%03d" $index)"
    mkdir -p "$dir"
    echo "Unpacking ${file} to ${dir}"
    unpack_img "$DUD_DIR/$file" "$dir"
    ((index++))

    # FIXME: do not ignore the dist (e.g., "tw" in "x86_64-tw").
    arch=$(uname -m)
    dud_root=$(echo "${dir}/linux/suse/${arch}"-*)
    echo "Detected DUD root at ${dud_root}"

    apply_update "$dud_root"
    copy_packages "$dud_root" "$DUD_RPM_REPOSITORY"
  done <$AGAMA_DUD_INFO

  create_repo "$DUD_RPM_REPOSITORY"
}

# Apply an update to the installation system.
#
# inst-sys updates are applied by copying files instead of installing packages. For that reason,
# it might be needed to do some adjustments "manually", like settings the alternative links.
apply_update() {
  dud_dir=$1
  echo "Apply inst-sys update from ${dud_dir}"

  cp -a "${dud_dir}/inst-sys/"* $NEWROOT

  dud_instsys="${dud_dir}/inst-sys"

  set_alternative "$dud_instsys" "agama-autoyast"
  set_alternative "$dud_instsys" "agamactl"
  set_alternative "$dud_instsys" "agama-proxy-setup"
}

# Sets the alternative links.
set_alternative() {
  dud_instsys=$1
  name=$2

  executables=("$dud_instsys/usr/bin/${name}.ruby"*-*)
  executable=${executables[0]}
  $NEWROOT/usr/bin/chroot $NEWROOT /usr/sbin/update-alternatives --install "/usr/bin/$name" "$name" "${executable##"$dud_instsys"}" 150000
  $NEWROOT/usr/bin/chroot $NEWROOT /usr/sbin/update-alternatives --set "$name" "${executable##"$dud_instsys"}"
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
  repo_dir=$2
  echo "Copy packages from ${dud_dir} to ${repo_dir}"

  for rpm in "$dud_dir"/install/*.rpm; do
    mkdir -p "$repo_dir"
    cp "$rpm" "$repo_dir"
  done
}

# Creates the repository metadata.
create_repo() {
  repo_dir=$1

  $NEWROOT/usr/bin/chroot $NEWROOT createrepo_c "${repo_dir##"$NEWROOT"}"
}

apply_updates
