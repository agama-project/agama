#!/bin/bash

[ -e /dracut-state.sh ] && . /dracut-state.sh

. /lib/dracut-lib.sh

fetch_updates() {
  # Agama driver updates
  local updates
  updates=$(getargs inst.dud=)
  if [ -n "$updates" ]; then
    echo "$updates" >/tmp/agamadud.info

    # automatically configure network when a remote DUD is used,
    # check for all remote URL scheme supported by the "agama download"
    # (anything supported by the curl backend https://everything.curl.dev/protocols/curl.html),
    # because it can match everywhere in the text it also matches the tftp:// and sftp://
    if grep -q -s -E -e "https?://" -e "ftps?://" -e "smbs?://" -e "scp://" /tmp/agamadud.info; then
      echo "rd.neednet=1" > /etc/cmdline.d/agama-generated.conf
      # use DHCP if there is no network configuration provided by user
      if ! getarg "ip="; then
        echo "ip=dhcp" >> /etc/cmdline.d/agama-generated.conf
      fi
    fi
  fi
}

fetch_updates
