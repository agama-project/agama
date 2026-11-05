#!/bin/sh
# Check that the kernel modules for the running kernel are present, either in
# the initrd (no argument) or in the mounted root image (the root directory
# is passed as the argument, e.g. /sysroot).
#
# If they do not match (e.g. a mixed up kernel, initrd or root image from
# different builds) the kernel drivers cannot be loaded and the boot fails
# later in some obscure way.

root="${1:-}"
release=$(uname -r)

if [ -z "$root" ]; then
  what="initrd"
  path="/lib/modules"
else
  what="root image ($root)"
  path="$root/lib/modules"
fi

if [ -d "$path/$release" ]; then
  echo "The $what matches the kernel ($release)"
  exit 0
fi

# the output goes to the system console (see the service file)
cat <<MSG

ERROR: The $what does not match the booted kernel!

The kernel version is "$release", but the $path/$release
directory does not exist. The kernel modules cannot be loaded.
This is a bug in the installation medium or in the boot configuration.

Available kernel modules in the $what:
$(ls -1 "$path" 2>&1)

Starting the emergency shell for debugging...

MSG

exit 1
