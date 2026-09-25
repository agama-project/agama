#!/bin/sh

# This systemd generator allows using single "inst.cc=1" boot option
# instead of "systemd.unit=multi-user.target systemd.wants=cc-setup.service
# inst.remote=0" options. The advantage is that we need less boot options and it
# also avoids saving the systemd.* options also to the installed system which we
# do not want.

# systemd passes: $1 = normal dir, $2 = early dir, $3 = late dir
set -eu

normal_dir="${1:-/run/systemd/generator}"
early_dir="${2:-/run/systemd/generator.early}"

cmdline="${CC_CMDLINE:-$(cat /proc/cmdline)}" # CC_CMDLINE allows testing

enabled=0
for arg in $cmdline; do
  case "$arg" in
    inst.cc=1) enabled=1 ;;
    inst.cc=*) enabled=0 ;; # last occurrence wins, like the kernel
  esac
done

if [ "$enabled" != 1 ]; then
  exit 0
fi

# Equivalent of systemd.unit=multi-user.target
mkdir -p "$early_dir"
ln -sf /usr/lib/systemd/system/multi-user.target "$early_dir/default.target"

# Equivalent of systemd.wants=cc-setup.service
mkdir -p "$normal_dir/multi-user.target.wants"
ln -sf /etc/systemd/system/cc-setup.service "$normal_dir/multi-user.target.wants/cc-setup.service"

# Equivalent of inst.remote=0 on boot command line, do not add it if already present
agama_conf="/run/agama/cmdline.d/agama.conf"
if ! grep -q "\binst.remote=" "$agama_conf"; then
  echo "inst.remote=0" >> "$agama_conf"
fi
