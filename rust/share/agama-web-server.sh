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
OPTIONS=(--address :::80 --address2 :::443)

# check if the "inst.listen_on=" boot option was used
if grep -q "\binst.listen_on=" /run/agama/cmdline.d/agama.conf; then
  LISTEN_ON=$(grep "\binst.listen_on=" /run/agama/cmdline.d/agama.conf | sed 's/.*\binst.listen_on=\([^[:space:]]\+\)/\1/')

  if [ "$LISTEN_ON" = "localhost" ]; then
    echo "<5>Disabling remote access to the Agama web server"
    # listen only on the local loopback interface, HTTP port only
    OPTIONS=(--address ::1:80)
  elif [ "$LISTEN_ON" = "any" ]; then
    echo "<5>Listening on all network interfaces"
  else
    # check if the value an IP address (IPv6 or IPv4)
    if echo "$LISTEN_ON" | grep -qE '^[0-9a-fA-F:.]+$|^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
      echo "<5>Listening on IP address ${LISTEN_ON}"
      # listen on local loopback (HTTP) + specified IP (HTTPS)
      OPTIONS=(--address ::1:80 --address2 "${LISTEN_ON}:443")
    else
      if ip addr show dev "${LISTEN_ON}" >/dev/null 2>&1; then
        # find the IP address for the specified interface
        IP_ADDR=$(ip -o -4 addr show dev "${LISTEN_ON}" | awk '{print $4}' | cut -d/ -f1 | head -n1)

        if [ -n "${IP_ADDR}" ]; then
          echo "<5>Listening on interface ${LISTEN_ON} with IP address ${IP_ADDR}"
          # listen on local loopback (HTTP) + specified interface (HTTPS)
          OPTIONS=(--address ::1:80 --address2 "${IP_ADDR}:443")
        else
          echo "<3>IP address for interface ${LISTEN_ON} not found, using defaults"
        fi
      else
        echo "<3>Interface ${LISTEN_ON} not found, using defaults"
      fi
    fi
  fi
else
  echo "<5>Listening on all network interfaces"
fi

exec /usr/bin/agama-web-server serve "${OPTIONS[@]}"
