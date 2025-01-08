#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

get_agama_args() {
  local _i _found

  for _i in $CMDLINE; do
    case $_i in
    LIBSTORAGE_* | YAST_* | agama* | Y2* | ZYPP_*)
      _found=1
      ;;
    esac

    if [ -n "$_found" ]; then
      printf "Agama variable found ($_i)"
      if ! strstr "$_i" "="; then
        # Set the variable as a boolean if there is no assignation
        _i="${_i}=1"
      fi
      echo $_i >>/etc/cmdline.d/99-agama-cmdline.conf
    fi
    unset _found
  done

  return 0
}

get_agama_args
