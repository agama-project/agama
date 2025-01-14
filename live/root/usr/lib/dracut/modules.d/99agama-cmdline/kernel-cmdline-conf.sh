#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

get_kernel_args() {
  local _i _found _path

  mkdir -p "$NEWROOT/etc/agama.d"
  _path="$NEWROOT/etc/agama.d/kernel.cmdline.conf"
  # ensure that kernel cmdline line is created to avoid reading agama params
  # if there is no kernel params
  touch "$_path"

  for _i in $CMDLINE; do
    case $_i in
    LIBSTORAGE_* | YAST_* | agama* | Y2* | ZYPP_* | root=* | info=* | autoyast* )
      _found=1
      ;;
    esac

    if [ -z "$_found" ]; then
      printf "Non-Agama parameter found ($_i)"
      echo "$_i" >>"$_path"
    fi
    unset _found
  done

  return 0
}

get_kernel_args
