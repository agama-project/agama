#! /bin/sh

set -e

TARGET="${1:-/run/agama/cmdline.d/agama}"
INFO_CONTENT="${2:-/run/agama/cmdline.d/info}"

expand_info_arg() {
  INFO_URL=$(sed -n 's/\(.*[[:space:]]\|^\)agama\.info=\([^[:space:]]\+\).*/\2/p' "$TARGET")
  if [ -z "${INFO_URL}" ]; then
    return 0
  fi

  # TODO: should we use also --location-trusted if info file url contain user and password?
  # if so check with security team
  curl --location --silent "${INFO_URL}" > "${INFO_CONTENT}"
  # remove info param
  sed -in 's/\([[:space:]]\|^\)agama\.info=[^[:space:]]\+//' "${TARGET}"
  # and add content of info file
  cat "${INFO_CONTENT}" >> "${TARGET}"

  return 0
}

expand_info_arg
