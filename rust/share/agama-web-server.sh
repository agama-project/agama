#!/usr/bin/bash
#
# Copyright (c) [2026] SUSE LLC
#
# All Rights Reserved.
#
# This program is free software; you can redistribute it and/or modify it
# under the terms of the GNU General Public License as published by the Free
# Software Foundation; either version 2 of the License, or (at your option)
# any later version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
# FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
# more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, contact SUSE LLC.
#
# To contact SUSE LLC about this file by physical or electronic mail, you may
# find current contact information at www.suse.com.

# This script is a wrapper for the Agama web server

# the default options: listen on all interfaces for both HTTP and HTTPS ports
OPTIONS=(--address ":::80,0.0.0.0:80" --address ":::443,0.0.0.0:443")
# option for localhost access only
LOCAL_OPTIONS=(--address "::1:80,127.0.0.1:80" --address "::1:443,127.0.0.1:443")

# check if the "inst.listen_on=" boot option was used
if grep -q "\binst.listen_on=" /run/agama/cmdline.d/agama.conf; then
  LISTEN_ON=$(grep "\binst.listen_on=" /run/agama/cmdline.d/agama.conf | sed 's/.*\binst.listen_on=\([^[:space:]]\+\)/\1/')

  if [ "$LISTEN_ON" = "localhost" ]; then
    echo "<5>Disabling remote access to the Agama web server"
    # listen only on the local loopback interface (HTTP + HTTPS)
    OPTIONS=("${LOCAL_OPTIONS[@]}")
  elif [ "$LISTEN_ON" = "all" ]; then
    echo "<5>Listening on all network interfaces"
  else
    # check if the value is an IP address (IPv6, IPv6 link local or IPv4)
    if echo "$LISTEN_ON" | grep -qE '^[0-9a-fA-F:]+$|^[fF][eE]80|^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
      # run on localhost
      OPTIONS=("${LOCAL_OPTIONS[@]}")
      echo "<5>Listening on IP address ${LISTEN_ON}"
      OPTIONS+=(--address "${LISTEN_ON}:80" --address "${LISTEN_ON}:443")
    else
      # otherwise consider it as an interface name
      # run on localhost
      OPTIONS=("${LOCAL_OPTIONS[@]}")
      if ip addr show dev "${LISTEN_ON}" >/dev/null 2>&1; then
        # find the IP address for the specified interface
        IP_ADDRS=$(ip -o addr show dev "${LISTEN_ON}" | awk '{print $4}' | cut -d/ -f1)
        if [ -n "${IP_ADDRS}" ]; then
          for IP in $IP_ADDRS; do
            # append the %device for link local IPv6 addresses
            if [[ "$IP" == fe80* ]]; then
              IP="${IP}%${LISTEN_ON}"
            fi
            echo "<5>Listening on interface ${LISTEN_ON} with IP address ${IP}"
            OPTIONS+=(--address "${IP}:80" --address "${IP}:443")
          done
        else
          echo "<3>IP address for interface ${LISTEN_ON} not found, enabling local access only"
        fi
      else
        echo "<3>Network Interface ${LISTEN_ON} not found, enabling local access only"
      fi
    fi
  fi
else
  echo "<5>Listening on all network interfaces"
fi

echo "<5>Starting Agama web server with options: ${OPTIONS[*]}"
exec /usr/bin/agama-web-server serve "${OPTIONS[@]}"
