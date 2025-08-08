#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

# see /usr/lib/dracut/modules.d/99base/dracut-lib.sh
# or https://github.com/dracut-ng/dracut-ng/blob/main/modules.d/80base/dracut-lib.sh
. /lib/dracut-lib.sh
# see /usr/lib/dracut/modules.d/99img-lib/img-lib.sh
# or https://github.com/dracut-ng/dracut-ng/blob/main/modules.d/70img-lib/img-lib.sh
. /lib/img-lib.sh

DUD_DIR="$NEWROOT/run/agama/dud"
AGAMA_CLI="$NEWROOT/usr/bin/agama"
AGAMA_DUD_INFO="/tmp/agamadud.info"
DUD_RPM_REPOSITORY="$NEWROOT/var/lib/agama/dud/repo"

shopt -s nullglob

# Applies all the updates
#
# Reads the URL of the updates from $AGAMA_DUD_INFO and process each one.
apply_updates() {
  local file
  local dud_url
  local dud_root
  local options
  index=0

  # make sure the HTTPS downloads work correctly
  configure_ssl

  # ignore SSL problems when the "inst.dud_insecure" or "inst.dud_insecure=1" boot options are present
  if getargbool 0 inst.dud_insecure; then
    echo "WARNING: Disabling SSL checks in DUD downloads"
    options="--insecure"
  fi

  while read -r dud_url; do
    mkdir -p "$DUD_DIR"
    filename=${dud_url##*/}
    file="${DUD_DIR}/${filename}"
    # FIXME: use an index because two updates, coming from different places, can have the same name.
    echo "Fetching a Driver Update Disk from $dud_url to ${file}"
    if ! $AGAMA_CLI $options download "$dud_url" "${file}"; then
      warn "Failed to fetch the Driver Update Disk"
      continue
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
      unpack_dud_update "$file" "$dir"
      apply_dud_update "$dir"
      ;;
    esac

    ((index++))
  done <$AGAMA_DUD_INFO
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

# Unpacks a driver update archive (DUD) to a directory
#
unpack_dud_update() {
  file=$1
  dir=$2

  echo "Unpack Driver Update Disk archive"
  unpack_img "$file" "$dir"
}

# Applies a driver update (DUD)
#
#   1. Copy the inst-sys updates to the $NEWROOT system.
#   2. Update agamactl, agama-autoyast and agama-proxy-setup alternative links.
#   3. Copy the packages to the $DUD_RPM_REPOSITORY.
apply_dud_update() {
  dir=$1

  echo "Apply update from a Driver Update Disk archive"

  # FIXME: do not ignore the dist (e.g., "tw" in "x86_64-tw").

  # notes:
  # (1) there can be several updates in a single archive; each with a
  #     prefix directory consisting of a number
  # (2) there can be ARCH-DIST subdirs with multiple dists - pick one and
  #     ignore the others
  arch=$(uname -m)
  for base_dir in "${dir}"/linux/suse "${dir}"/[0-9]*/linux/suse ; do
    [ -d "$base_dir" ] || continue
    for dud_root in "${base_dir}/${arch}"-* ; do
      [ -d "$dud_root" ] || continue
        install_update "${dud_root}/inst-sys"
        copy_packages "$dud_root" "$DUD_RPM_REPOSITORY"
        update_kernel_modules "$dud_root"
      break
    done
  done
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

# Applies an update to the installation system
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

# Sets the alternative links
set_alternative() {
  dud_instsys=$1
  name=$2
  # Use the same value used during RPMs installation.
  priority=150000

  executables=("$dud_instsys/usr/bin/${name}.ruby"*-*)
  executable=${executables[0]}
  if [ -n "$executable" ]; then
    "$NEWROOT/usr/bin/chroot" "$NEWROOT" /usr/sbin/update-alternatives \
      --install "/usr/bin/$name" "$name" "${executable##"$dud_instsys"}" "$priority"
    "$NEWROOT/usr/bin/chroot" "$NEWROOT" /usr/sbin/update-alternatives \
      --set "$name" "${executable##"$dud_instsys"}"
  fi
}

# Copies the packages to use during installation
#
# This function is mainly a PoC.
#
# This is a simplistic version that just copies all the RPMs to the new repository.
# In the future, it might need to put each package under a different repository depending
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

# Finds the kernel modules to update
#
# It searches for the modules in the modules/ directory of the update.
find_kernel_modules() {
  local directory=$1
  local -n modules=$2
  local module_name
  local files

  modules=()
  files=("${directory}"/*.ko*)
  for module in "${files[@]}"; do
    module_name=${module#"${directory}/"}
    module_name=${module_name%.ko*}

    if [[ ! " ${modules[*]} " =~ " ${module_name} " ]]; then
      modules+=("$module_name")
    fi
  done

  echo "Found ${#files[@]} kernel modules"
}

# Copies a kernel module
#
# It searches for a module with the same name. If found, it replaces it.
# Otherwise, it copies the module to the top-level modules directory.
copy_kernel_module() {
  local source_dir=$1
  local module=$2
  local target_dir=$3
  local source_file

  echo "Copying ${module}..."

  # expect a single file with $module.ko* name
  source_file=("${source_dir}/${module}".ko*)

  old_module=("${target_dir}"/**/*/"${module}".ko*)
  if [ "${#old_module[@]}" -eq "1" ]; then
    info "  Replacing the module ${old_module[0]}"
    cp "${source_file[0]}" "${old_module[0]}"
  elif [ "${#old_module[@]}" -eq "0" ]; then
    info "  Not found the module to replace, so copying to kernel/ directory."
    cp "${source_file[0]}" "${target_dir}"
  else
    info "  Skipping the module because several modules with the same name were found."
  fi
}

# Updates kernel modules
#
# It copies the kernel modules from the Driver Update Disk to the system under
# /sysroot. If it finds a `module.order` file, it unloads the modules included
# in the list and add them to /etc/modules-load.d/99-agama.conf file so they
# will be loaded by systemd after pivoting.
update_kernel_modules() {
  local dud_dir=$1
  local kernel_modules_dir
  kernel_modules_dir="${NEWROOT}/lib/modules/$(uname -r)"
  local dud_modules_dir="${dud_dir}/modules"

  # find and copy kernel modules
  local dud_modules
  find_kernel_modules "$dud_modules_dir" dud_modules

  # finish if no kernel module is included in DUD
  if (( ${#dud_modules[@]} == 0 )); then
    echo "Skipping kernel modules update"
    return
  fi

  for module in "${dud_modules[@]}"; do
    echo "Processing ${module} module"
    copy_kernel_module "$dud_modules_dir" "$module" "${kernel_modules_dir}/kernel"
    rmmod "${module}" 2>&1
  done

  # unload modules in the module.order file and make sure they will be loaded
  if [ -f "${dud_modules_dir}/module.order" ]; then
    module_order=$(<"${dud_modules_dir}/module.order")
    # unload the modules in reverse order
    local idx
    idx=("${!module_order[@]}")
    for ((i = ${#idx[@]} - 1; i >= 0; i--)); do
      rmmod "${module_order[$i]}" 2>&1
    done

    cp "${dud_modules_dir}/module.order" "${NEWROOT}/etc/modules-load.d/99-agama.conf"
  fi

  # update modules dependencies on the live medium
  info "Updating modules dependencies..."
  depmod -a -b "$NEWROOT"
}

# link the SSL certificates and related configuration from the root image so "agama download"
# works correctly with the HTTPS resources (expects using correct and well-known certificates)
configure_ssl() {
  # link the SSL certificates
  ! [ -d /etc/ssl ] && ln -s "$NEWROOT/etc/ssl" /etc

  # link crypto configuration (which ciphers are allowed, etc)
  ! [ -d /etc/crypto-policies ] && ln -s "$NEWROOT/etc/crypto-policies" /etc
}

# there can be (already unpacked) driver updates directly in the initrd
apply_dud_update ""

if [ -f "$AGAMA_DUD_INFO" ]; then
  apply_updates
fi
