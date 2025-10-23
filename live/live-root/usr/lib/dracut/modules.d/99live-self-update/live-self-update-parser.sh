#!/bin/bash

# redirect stdout/stderr to systemd journal using the "live-self-update"
# identifier, later the self-update logs can be filtered by using command
# "journalctl -t live-self-update" which includes the output from this dracut
# hook and the self-update service as well
exec > >(systemd-cat -t live-self-update) 2>&1

. /lib/dracut-lib.sh

FILE="/etc/cmdline.d/agama-self-update-generated.conf"
REPO_FILE="/run/live-self-update/repositories"

mkdir -p $(dirname "$REPO_FILE")

get_url() {
  # Agama driver updates
  local url
  url=$(getargs "inst.self_update=")

  if [ "$url" == "0" ]; then
    echo "<5>Self update disabled via boot parameter"
  elif [ -z "$url" ]; then
    echo "<5>Self update repository not configured"
    # TODO: if a custom repo is not set then query SCC/RMT here or use a fallback URL
  else
    echo "<5>Using custom self update repository: $url"
    echo "$url" > "$REPO_FILE"

    # automatically configure network when a remote self-update repository is used,
    # match all remote protocols supported by zypper (see "man zypper"),
    if grep -q -s -E -e "https?://" -e "ftp://" -e "smb://" -e "cifs://" -e "nfs4?://" -e "obs://" "$REPO_FILE"; then
      echo "rd.neednet=1" > "$FILE"
      # use DHCP if there is no network configuration provided by user
      if ! getarg "ip="; then
        echo "ip=dhcp" >> "$FILE"
      fi
    fi
  fi
}

get_url
