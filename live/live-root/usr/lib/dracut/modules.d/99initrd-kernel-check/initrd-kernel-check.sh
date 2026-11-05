#!/bin/sh
# Check that the initrd contains the kernel modules for the running kernel. If
# the initrd does not match the kernel (e.g. a mixed up kernel and initrd from
# different builds or products) the kernel drivers cannot be loaded and the boot
# fails later in some ugly way for no obvious reason.

release=$(uname -r)

if [ -d "/lib/modules/$release" ]; then
  echo "The initrd matches the kernel ($release)"
  exit 0
fi

# the output goes to the system console (see the service file)
cat <<MSG

ERROR: The initrd does not match the booted kernel!

The kernel version is "$release", but the /lib/modules/$release directory
does not exist in the initrd. The kernel modules cannot be loaded.
This is a bug in the installation medium or in the boot configuration.

Available kernel modules in the initrd:
$(ls -1 /lib/modules 2>&1)

Starting the emergency shell for debugging...

MSG

exit 1
