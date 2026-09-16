#!/bin/sh

# This systemd generator allows using single "live.cc-install=1" boot option
# instead of "systemd.unit=multi-user.target systemd.wants=cc-setup.service"
# options. The advantage is that we need less boot options and it also avoids
# saving the systemd.* options also to the installed system which we do not
# want.

# systemd passes: $1 = normal dir, $2 = early dir, $3 = late dir
set -eu

normal_dir="${1:-/run/systemd/generator}"
early_dir="${2:-/run/systemd/generator.early}"

cmdline="${CC_CMDLINE:-$(cat /proc/cmdline)}" # CC_CMDLINE allows testing

enabled=0
for arg in $cmdline; do
  case "$arg" in
  live.cc-install=1) enabled=1 ;;
  live.cc-install=*) enabled=0 ;; # last occurrence wins, like the kernel
  esac
done

[ "$enabled" = 1 ] || exit 0

# Equivalent of systemd.unit=multi-user.target
mkdir -p "$early_dir"
ln -sf /usr/lib/systemd/system/multi-user.target "$early_dir/default.target"

# Equivalent of systemd.wants=cc-setup.service
mkdir -p "$normal_dir/multi-user.target.wants"
ln -sf /etc/systemd/system/cc-setup.service "$normal_dir/multi-user.target.wants/cc-setup.service"
