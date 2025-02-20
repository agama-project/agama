#! /bin/sh

# Script that expand agama.info parameter by downloading its file and appending it to agama.conf
# the info content is stored in info.conf

set -e

TARGET="${1:-/run/agama/cmdline.d/agama.conf}"
INFO_CONTENT="${2:-/run/agama/cmdline.d/info.conf}"

expand_info_arg() {
  INFO_URL=$(sed -n 's/\(.*[[:space:]]\|^\)\(inst\|agama\)\.info=\([^[:space:]]\+\).*/\2/p' "$TARGET")
  if [ -z "${INFO_URL}" ]; then
    return 0
  fi

  # TODO: should we use also --location-trusted if info file url contain user and password?
  # if so check with security team
  curl --location --silent "${INFO_URL}" > "${INFO_CONTENT}"
  # remove info param
  sed -in 's/\([[:space:]]\|^\)\(inst\|agama\)\.info=[^[:space:]]\+//' "${TARGET}"
  # and add content of info file
  cat "${INFO_CONTENT}" >> "${TARGET}"

  return 0
}

expand_info_arg
