#!/bin/bash

# redirect stdout/stderr to systemd journal using the "live-self-update"
# identifier, later the self-update logs can be filtered by using command
# "journalctl -t live-self-update" which includes the output from this dracut
# hook and the self-update service as well
exec > >(systemd-cat -t live-self-update) 2>&1

. /lib/dracut-lib.sh
# generate Dracut command line options
FILE="/etc/cmdline.d/live-self-update-generated.conf"

# source the shared self-update configuration variables
. ./lib/live-self-update/conf.sh

mkdir -p "$RUN_DIR"

configure_network() {
  # skip the network configuration if "rd.neednet=0" option was used by user
  if getargbool 1 rd.neednet; then
    echo "<5>Enabling network configuration"
    echo "rd.neednet=1" > "$FILE"
    # use DHCP if there is no network configuration provided by user
    if ! getarg "ip="; then
      echo "Using default DHCP network configuration"
      echo "ip=dhcp" >> "$FILE"
    fi
  else
    echo "<5>Network configuration disabled by the rd.neednet=0 boot parameter"
  fi
}

# skip self-update, either it was explicitly disabled by user or is not
# configured in the product (like openSUSE)
skip() {
  echo "<5>$1"
  # create a skip file
  true > "$SKIP_FILE"
}

# evaluate the registration server (SCC or RMT)
get_reg_server() {
  local url
  url=$(getargs "inst.register_url=")

  if [ -n "$url" ]; then
    echo "<5>Will use a custom registration server $url for obtaining the self-update repository"
    echo "$url" > "$SERVER_FILE"
    configure_network
  elif [ -s "$CONFIG_DEFAULT_REG_SERVER_FILE" ]; then
    echo "<5>Will use the default registration server $(cat "$CONFIG_DEFAULT_REG_SERVER_FILE") for obtaining the self-update repository"
    configure_network
  elif [ -s "$CONFIG_FALLBACK_FILE" ]; then
    echo "<5>Will use the fallback self-update URL $(cat "$CONFIG_FALLBACK_FILE")"
    configure_network
  else
    skip "Self update not configured"
  fi
}

# evaluate the self-update URL:
# 1. explicitly set with the "inst.self_update" boot option
# 2. SCC or RMT server is configured (it will be asked later)
# 3. fallback URL if present
# 4. if no URL is set self-update is skipped
get_url() {
  local url
  url=$(getargs "inst.self_update=")

  if [ "$url" == "0" ]; then
    skip "Self update disabled via boot parameter"
  elif [ -z "$url" ]; then
    get_reg_server
  else
    echo "<5>Using custom self update repository: $url"
    echo "$url" > "$REPO_FILE"

    # automatically configure network when a remote self-update repository is used,
    # match all remote protocols supported by zypper (see "man zypper"),
    if grep -q -s -E -e "https?://" -e "ftp://" -e "smb://" -e "cifs://" -e "nfs4?://" -e "obs://" "$REPO_FILE"; then
      configure_network
    fi
  fi
}

get_url
