#! /bin/sh

SOURCE="${1:-/proc/cmdline}"
TARGET="${2:-/etc/agama.d/kernel.cmdline.conf}"

write_kernel_args() {
  DIR=$(dirname "${TARGET}")
  mkdir -p "$DIR"
  # ensure that kernel cmdline line is created to avoid reading agama params
  # if there is no kernel params
  touch "${TARGET}"

  for _i in $(cat "${SOURCE}"); do
    case ${_i} in
    # remove all agama kernel params
    LIBSTORAGE_* | YAST_* | agama* | Y2* | ZYPP_* | autoyast* )
      _found=1
      ;;
    esac

    if [ -z "$_found" ]; then
      echo "Non-Agama parameter found ($_i)"
      echo -n " $_i" >>"${TARGET}"
    fi
    unset _found
  done

  return 0
}

write_kernel_args
