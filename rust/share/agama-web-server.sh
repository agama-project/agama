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

# This script is a wrapper for the Agama web server, it evaluates to which
# addresses the server should listen to.

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  echo "Usage: $0"
  echo
  echo "  This is a wrapper script for the Agama web server (agama-web-server)."
  echo
  echo "  It configures the listening addresses for the web server based on"
  echo "  the \"inst.listen_on\" boot option."
  exit 0
fi

# the default options: listen on all interfaces for both HTTP and HTTPS ports,
# the IPv4 addresses are fallbacks when IPv6 is disabled with the
# "ipv6.disable=1" kernel boot option
DEFAULT_OPTIONS=(--address ":::80,0.0.0.0:80" --address ":::443,0.0.0.0:443")
# options for localhost access only
LOCAL_OPTIONS=(--address "::1:80,127.0.0.1:80" --address "::1:443,127.0.0.1:443")

# check if the "inst.listen_on=" boot option was used
if grep -q "\binst.listen_on=.\+" /run/agama/cmdline.d/agama.conf; then
  LISTEN_ON=$(grep "\binst.listen_on=.\+" /run/agama/cmdline.d/agama.conf | sed 's/.*\binst.listen_on=\([^[:space:]]\+\)/\1/')

  if [ "$LISTEN_ON" = "localhost" ]; then
    OPTIONS=("${LOCAL_OPTIONS[@]}")
  elif [ "$LISTEN_ON" = "all" ]; then
    OPTIONS=("${DEFAULT_OPTIONS[@]}")
  else
    # always run on the localhost
    OPTIONS=("${LOCAL_OPTIONS[@]}")

    # the string can contain multiple addresses separated by comma,
    # replace commas with spaces and iterate over items
    ADDRESSES=${LISTEN_ON//,/ }
    for ADDRESS in $ADDRESSES; do
      # check if the value is an IP address (IPv6, IPv6 link local or IPv4)
      if echo "$ADDRESS" | grep -qE '^[0-9a-fA-F:]+$|^[fF][eE]80|^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
        echo "<5>Listening on IP address ${ADDRESS}"
        OPTIONS+=(--address "${ADDRESS}:80" --address "${ADDRESS}:443")
      else
        # otherwise assume it is as an interface name
        if ip addr show dev "${ADDRESS}" >/dev/null 2>&1; then
          # find the IP address for the specified interface
          IP_ADDRS=$(ip -o addr show dev "${ADDRESS}" | awk '{print $4}' | cut -d/ -f1)
          if [ -n "${IP_ADDRS}" ]; then
            for IP in $IP_ADDRS; do
              # append the %device for link local IPv6 addresses
              if [[ "$IP" == fe80* ]]; then
                IP="${IP}%${ADDRESS}"
              fi
              echo "<5>Listening on interface ${ADDRESS} with IP address ${IP}"
              OPTIONS+=(--address "${IP}:80" --address "${IP}:443")
            done
          else
            echo "<3>IP address for interface ${ADDRESS} not found"
          fi
        else
          echo "<3>Network Interface ${ADDRESS} not found"
        fi
      fi
    done
  fi
else
  OPTIONS=("${DEFAULT_OPTIONS[@]}")
fi

if [ "${OPTIONS[*]}" = "${DEFAULT_OPTIONS[*]}" ]; then
  echo "<5>Listening on all network interfaces"
elif [ "${OPTIONS[*]}" = "${LOCAL_OPTIONS[*]}" ]; then
  echo "<5>Disabling remote access to the Agama web server"
fi

echo "<5>Starting Agama web server with options: ${OPTIONS[*]}"
exec /usr/bin/agama-web-server serve "${OPTIONS[@]}"
