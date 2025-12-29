/*
 * Copyright (c) [2025] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React from "react";
import { Flex } from "@patternfly/react-core";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { useDevices } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { isEmpty } from "radashi";
import { useConnections } from "~/hooks/model/proposal/network";
import { formatIp } from "~/utils/network";
import { sprintf } from "sprintf-js";
import { _, n_ } from "~/i18n";

import type { IPAddress } from "~/types/network";

const addressesSummary = (addresses: IPAddress[]) => {
  const formattedAddresses = addresses.map(formatIp);
  const [first, second, ...rest] = formattedAddresses;

  if (!isEmpty(rest)) {
    // TRANSLATORS: Summary of IP addresses shown in the network details.
    // %1$s and %2$s are the first two IP addresses.
    // %3$d is the number of additional IP addresses not shown.
    // The resulting string is a comma-separated list ending with "and N more".
    return sprintf(_("%1$s, %2$s and %3$d more"), first, second, rest.length);
  }

  if (!isEmpty(second)) {
    return `${first}, ${second}`;
  }

  return first;
};

const NotConfigured = () => {
  return (
    <Link to={NETWORK.root} variant="link" isInline>
      {_("Not configured")}
    </Link>
  );
};

const SummaryTitle = ({ usingDHCP, onlyDHCP }) => {
  if (onlyDHCP) {
    return _("Automatic (DHCP)");
  }

  if (usingDHCP) {
    return "Automatic and manual";
  }

  return _("Manual (static)");
};

const Summary = () => {
  const devices = useDevices();
  const connections = useConnections();
  const deviceAddresses = devices.flatMap((d) => d.addresses);
  const connectionsAddresses = connections.flatMap((c) => c.addresses);
  // FIXME:use te right conditions to determine if DHCP is in use or not.
  const usingDHCP = isEmpty(connectionsAddresses);
  const onlyDHCP = usingDHCP && isEmpty(deviceAddresses);

  return (
    <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
      <Link to={NETWORK.root} variant="link" isInline>
        <SummaryTitle usingDHCP={usingDHCP} onlyDHCP={onlyDHCP} />
      </Link>
      <small>
        {
          // TRANSLATORS: Short secondary summary shown under the network configuration.
          // %1$d is the number of network connections.
          // %2$s is a comma-separated list of IP addresses, possibly ending with "and N more".
          sprintf(
            n_("%1$d connection - %2$s", "%1$d connections - %2$s", connections.length),
            connections.length,
            addressesSummary([...deviceAddresses, ...connectionsAddresses]),
          )
        }
      </small>
    </Flex>
  );
};

export default function NetworkDetailsItem() {
  const connections = useConnections();

  return (
    <Details.Item label={_("Network")}>
      {isEmpty(connections) ? <NotConfigured /> : <Summary />}
    </Details.Item>
  );
}
