#!/bin/bash

# workaround for failing first boot detection in the Live ISO system

check() {
  # always include this dracut module in the initramfs
	return 0
}

depends() {
	echo bash systemd
}

install() {
  # Do not try detecting whether this is the first boot or not, consider every
  # boot as the first boot. That's true for the installer, we always start with
  # the same read-only root filesystem image from scratch.
  #
  # The problem is that the first boot detection fails because of the
  # complicated Live ISO setup which uses the device mapper for creating
  # writable overlay over the squashfs read-only image.
	$SYSTEMCTL -q --root "$initdir" disable firstboot-detect.service
	$SYSTEMCTL -q --root "$initdir" enable firstboot.target
}
