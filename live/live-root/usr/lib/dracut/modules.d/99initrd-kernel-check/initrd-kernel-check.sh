#!/bin/sh

# Check that the initrd, the kernel and the live root image match.
#
# Without an argument it checks that the initrd contains the kernel modules for
# the running kernel.
#
# With the root directory as the argument (e.g. /sysroot) it checks that the
# mounted root image contains the kernel modules for the running kernel and
# that it comes from the same product as the initrd (the CPE_NAME values in
# the os-release files are the same).

root="${1:-}"
release=$(uname -r)
failed=0

# print the CPE_NAME value from the specified os-release file,
# the file is parsed, not sourced, to avoid executing any code from it
get_cpe_name() {
  sed -n -e 's/^CPE_NAME=//p' "$1" 2>/dev/null | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/"
}

# the output goes to the system console (see the service file)
report() {
  failed=1
  echo
  echo "ERROR: $1"
  echo
}

path="$root/lib/modules"

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
$(ls -1 "$path" 2>&1)"
fi

if [ -n "$root" ]; then
  initrd_cpe=$(get_cpe_name /etc/initrd-release)
  root_cpe=$(get_cpe_name "$root/etc/os-release")

  if [ "$initrd_cpe" = "$root_cpe" ]; then
    echo "The $what matches the initrd (CPE_NAME: \"$initrd_cpe\")"
  else
    report "The $what does not match the initrd!

The CPE_NAME value is different:
  /etc/initrd-release:      \"$initrd_cpe\"
  $root/etc/os-release: \"$root_cpe\""
  fi
fi

if [ "$failed" -ne 0 ]; then
  echo "This is a bug in the installation medium or in the boot configuration."
  echo
  echo "Starting the emergency shell for debugging..."
  echo
  exit 1
fi

exit 0
