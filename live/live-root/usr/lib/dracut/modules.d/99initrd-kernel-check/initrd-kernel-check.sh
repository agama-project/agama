#!/bin/sh

# Check that the initrd, the kernel and the live root image match.
#
# The paths can be changed by environment variables (used in the unit tests):
#   INITRD_ROOT          - the initrd root directory (default: empty = /)
#   INITRD_RELEASE_FILE  - the initrd release file (default: /etc/initrd-release)
#   LOG_FILE             - the file for saving the errors
#                          (default: /run/initrd-kernel-check.log)

root="${1:-}"
release=$(uname -r)
failed=0

# save the errors for later
log="${LOG_FILE:-/run/initrd-kernel-check.log}"

# print the value of the specified key from the specified os-release file,
# the file is parsed, not sourced, to avoid executing any code from it
get_os_value() {
  sed -n -e "s/^$1=//p" "$2" 2>/dev/null | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# the output goes to the system console (see the service file) and to the                  log file
report() {
  failed=1
  {
    echo
    echo "ERROR: $1"
    echo
  } | tee -a "$log"
}

path="${root:-$INITRD_ROOT}/lib/modules"

if [ -z "$root" ]; then
  what="initrd"
else
  what="root image ($root)"
fi

if [ -d "$path/$release" ]; then
  echo "The $what matches the kernel ($release)"
else
  report "The $what does not match the booted kernel!

The kernel version is \"$release\", but the $path/$release
directory does not exist. The kernel modules cannot be loaded.

Available kernel modules in the $what:
$(ls -1 "$path" | grep -v keys)"
fi

if [ -n "$root" ]; then
  initrd_release="${INITRD_RELEASE_FILE:-/etc/initrd-release}"
  root_release="$root/etc/os-release"

  # the CPE_NAME in Tumbleweed contains the snapshot number, compare only the ID
  if [ "$(get_os_value ID "$initrd_release")" = "opensuse-tumbleweed" ]; then
    key=ID
  else
    key=CPE_NAME
  fi

  initrd_value=$(get_os_value "$key" "$initrd_release")
  root_value=$(get_os_value "$key" "$root_release")

  if [ "$initrd_value" = "$root_value" ]; then
    echo "The $what matches the initrd ($key: \"$initrd_value\")"
  else
    report "The $what does not match the initrd!

The $key value is different:
  $initrd_release:     \"$initrd_value\"
  $root_release: \"$root_value\""
  fi
fi

if [ "$failed" -ne 0 ]; then
  {
    echo "This is a bug in the installation medium or in the boot configuration."
    echo
    echo "Starting the emergency shell for debugging..."
    echo
  } | tee -a "$log"
  exit 1
fi

exit 0
