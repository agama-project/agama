#! /bin/bash

# Script to clean kernel command line from agama specific parameters. Result is later used for bootloader proposal.

SOURCE="${1:-/proc/cmdline}"
TARGET="${2:-/run/agama/cmdline.d/kernel.conf}"

write_kernel_args() {
  DIR=$(dirname "${TARGET}")
  mkdir -p "$DIR"
  # ensure that kernel cmdline line is created to avoid reading agama params
  # if there is no kernel params
  touch "${TARGET}"

  # silence the "To read lines rather than words..." hint
  # shellcheck disable=SC2013
  for _i in $(cat "${SOURCE}"); do
    case ${_i} in
    # remove all agama kernel params
    # Add here also all linuxrc supported parameters
    LIBSTORAGE_* | YAST_* | inst* | agama* | live* | Y2* | ZYPP_* | autoyast*)
      _found=1
      ;;
    # remove the Kiwi PXE boot options or Live options
    rd.kiwi.* | rd.live.* | ramdisk_size=* | initrd=* | BOOT_IMAGE=*)
      _found=1
      ;;
    # remove the network configuration options
    # https://man7.org/linux/man-pages/man7/dracut.cmdline.7.html
    ip=* | rd.route=* | bootdev=* | BOOTIF=* | rd.bootif=* | nameserver=* | \
    rd.peerdns=* | rd.neednet=* | vlan=* | bond=* | team=* | bridge=*)
      _found=1
      ;;
    esac

    if [ -z "$_found" ]; then
      echo "Using boot parameter \"$_i\""
      echo -n " $_i" >>"${TARGET}"
    else
      echo "Ignoring boot parameter \"$_i\""
    fi
    unset _found
  done

  return 0
}

write_kernel_args
