#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh
. /lib/img-lib.sh

DUD_DIR="$NEWROOT/run/agama/dud"
AGAMA_CLI="$NEWROOT/usr/bin/agama"
AGAMA_DUD_INFO="/tmp/agamadud.info"
DUD_RPM_REPOSITORY="$NEWROOT/var/lib/agama/dud/repo"

shopt -s nullglob

# Apply all the updates.
#
# Read the URL of the updates from $AGAMA_DUD_INFO and process each one.
apply_updates() {
  local file
  local dud_url
  local dud_root
  index=0

  while read -r dud_url; do
    mkdir -p "$DUD_DIR"
    filename=${dud_url##*/}
    file="${DUD_DIR}/${filename}"
    # FIXME: use an index because two updates, coming from different places, can have the same name.
    echo "Fetching a Driver Update Disk from $dud_url to ${file}"
    if ! $AGAMA_CLI download "$dud_url" "${file}"; then
      warn "Failed to fetch the Driver Update Disk"
      exit 1
    fi

    # The $dir could be a temporary one created by each function.
    dir="$DUD_DIR/dud_$(printf "%03d" $index)"
    mkdir -p "$dir"

    format=$("$NEWROOT/usr/bin/chroot" "$NEWROOT" file "${file##"$NEWROOT"}")
    case "$format" in
    *RPM*)
      apply_rpm_update "$file" "$dir"
      ;;

    *)
      apply_dud_update "$file" "$dir"
      ;;
    esac

    ((index++))
  done <$AGAMA_DUD_INFO

  create_repo "$DUD_RPM_REPOSITORY"
}

# Applies an update from an RPM package
#
# It extracts the RPM content and adjust the alternative links.
apply_rpm_update() {
  file=$1
  dir=$2

  echo "Apply update from an RPM package"
  unpack_rpm "$file" "$dir"
  install_update "$dir"
}

# Applies an update from an RPM package
#
#   1. Copy the inst-sys updates to the $NEWROOT system.
#   2. Update agamactl, agama-autoyast and agama-proxy-setup alternative links.
#   3. Copy the packages to the $DUD_RPM_REPOSITORY.
apply_dud_update() {
  file=$1
  dir=$2

  echo "Apply update from a Driver Update Disk archive"
  unpack_img "$file" "$dir"
  # FIXME: do not ignore the dist (e.g., "tw" in "x86_64-tw").
  arch=$(uname -m)
  dud_root=$(echo "${dir}/linux/suse/${arch}"-*)
  install_update "${dud_root}/inst-sys"
  copy_packages "$dud_root" "$DUD_RPM_REPOSITORY"
}

# Extracts an RPM file
#
# It uses rpm2cpio from the $NEWROOT.
unpack_rpm() {
  source=$1
  dest=$2
  echo "Unpacking RPM ${source} to ${dest}"

  mkdir -p "$dest"
  pushd "$dest" || exit 1
  "$NEWROOT/usr/bin/chroot" "$NEWROOT" /usr/bin/rpm2cpio "${source##"$NEWROOT"}" |
    cpio --extract --make-directories --preserve-modification-time
  popd || exit 1
}

# Applies an update to the installation system.
#
# Updates are applied by copying files instead of installing packages. For that
# reason, it might be needed to do some adjustments "manually", like settings
# the alternative links.
install_update() {
  dud_dir=$1
  echo "Apply inst-sys update from ${dud_dir}"

  cp -a "${dud_dir}"/* "$NEWROOT"

  set_alternative "$dud_dir" "agama-autoyast"
  set_alternative "$dud_dir" "agamactl"
  set_alternative "$dud_dir" "agama-proxy-setup"
}

# Sets the alternative links.
set_alternative() {
  dud_instsys=$1
  name=$2

  executables=("$dud_instsys/usr/bin/${name}.ruby"*-*)
  executable=${executables[0]}
  if [ ! -z "$executable" ]; then
    "$NEWROOT/usr/bin/chroot" "$NEWROOT" /usr/sbin/update-alternatives --install "/usr/bin/$name" "$name" "${executable##"$dud_instsys"}" 150000
    "$NEWROOT/usr/bin/chroot" "$NEWROOT" /usr/sbin/update-alternatives --set "$name" "${executable##"$dud_instsys"}"
  fi
}

# Copies the packages to use during installation
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

  "$NEWROOT/usr/bin/chroot" "$NEWROOT" createrepo_c "${repo_dir##"$NEWROOT"}"
}

if [ -f "$AGAMA_DUD_INFO" ]; then
  apply_updates
fi
