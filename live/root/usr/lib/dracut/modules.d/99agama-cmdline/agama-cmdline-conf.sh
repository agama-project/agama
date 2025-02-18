#! /bin/sh

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

TARGET="${1:-/run/agama/cmdline.d/agama}"
ENV_TARGET="${1:-/run/agama/cmdline.d/environment}"
get_agama_args() {
  local _i _found _env

  for _i in $CMDLINE; do
    case $_i in
    LIBSTORAGE_* | YAST_* | Y2* | ZYPP_*)
      _found=1
      _env=1
      ;;
    agama*)
      _found=1
      ;;
    esac

    if [ -n "$_found" ]; then
      if ! strstr "$_i" "="; then
        # Set the variable as a boolean if there is no assignation
        _i="${_i}=1"
      fi
      echo $_i >>"${TARGET}"
      if [ -n "$_env" ]; then
        _i=$(echo "$_i" | tr '[:lower:].-' '[:upper:]__'
        echo $_i >>"${ENV_TARGET}"
      fi
    fi
    unset _found _env
  done

  return 0
}

get_agama_args
