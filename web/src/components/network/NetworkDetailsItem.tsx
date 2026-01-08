/*
 * Copyright (c) [2025-2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { NETWORK } from "~/routes/paths";
import { NetworkStatus, useNetworkStatus } from "~/hooks/model/system/network";
import { formatIp } from "~/utils/network";
import { _, n_ } from "~/i18n";
import type { Connection } from "~/types/network";

type NetworkStatusValue = (typeof NetworkStatus)[keyof typeof NetworkStatus];

type DescriptionProps = {
  status: NetworkStatusValue;
  connections: Connection[];
};

type TitleProps = {
  status: NetworkStatusValue;
};

/**
 * Helper component that renders a brief description of the current network
 * configuration, based on the provided status and network connections
 */
const Description = ({ status, connections }: DescriptionProps) => {
  const connectionsQty = connections.length;
  const staticIps = connections
    .flatMap((c) => c.addresses)
    .map((a) => formatIp(a, { removePrefix: true }));
  const staticIpsQty = staticIps.length;

  // Format IP list once
  const ipList = (() => {
    if (staticIpsQty === 0) return "";
    if (staticIpsQty === 1) return staticIps[0];
    // TRANSLATORS: Displays two IP addresses. E.g., "192.168.1.1 and 192.168.1.2"
    // %s will be replaced by IP addresses
    if (staticIpsQty === 2) return sprintf(_("%s and %s"), staticIps[0], staticIps[1]);
    // TRANSLATORS: IPs summary when there are more than 2 static IP addresses.
    // E.g., "192.168.1.1 and 2 others"
    // %s is replaced by an IP address (e.g., "192.168.1.1")
    // %d is replaced by the count of remaining IPs (e.g., "2")
    return sprintf(_("%s and %d others"), staticIps[0], staticIpsQty - 1);
  })();

  switch (status) {
    case NetworkStatus.NOT_CONFIGURED:
      return null;
    case NetworkStatus.NO_PERSISTENT:
      // TRANSLATORS: Description shown when network connections are configured
      // only for installation and won't be available in the installed system
      return _("System will have no network connections");
    // return _("No connections will be copied to the installed system");
    case NetworkStatus.MANUAL: {
      if (connectionsQty === 1) return ipList;
      // TRANSLATORS: Summary for multiple manual network connections. E.g.,
      // "Using 3 connections with 192.168.1.1 and 2 others"
      // %d is replaced by the number of connections (e.g., "3")
      // %s is replaced by IP address summary (e.g., "192.168.1.1 and 2 others")
      return sprintf(_("Using %d connections with %s"), connectionsQty, ipList);
    }
    case NetworkStatus.MIXED: {
      // TRANSLATORS: Summary combining DHCP (automatic) with static IP
      // addresses %s is replaced by IP address(es), e.g., "192.168.1.1" or
      // "192.168.1.1 and 2 others"
      const dhcpAndIps =
        staticIpsQty === 1 ? sprintf(_("DHCP and %s"), ipList) : sprintf(_("DHCP, %s"), ipList);
      return connectionsQty === 1
        ? dhcpAndIps
        : // TRANSLATORS: Summary for multiple connections mixing automatic
          // (DHCP) and manual configuration. E.g., "Using 2 connections with DHCP
          // and 192.168.1.1"
          // %d is replaced by the number of connections (e.g., "2")
          // %s is replaced by configuration summary (e.g., "DHCP and 192.168.1.1")
          // Full example:
          sprintf(_("Using %d connections with %s"), connectionsQty, dhcpAndIps);
    }
    default:
      // TRANSLATORS: Generic summary for configured network connections
      // %d is replaced by the number of connections
      return sprintf(
        n_("Configured with %d connection", "Configured with %d connections", connectionsQty),
        connectionsQty,
      );
  }
};

/**
 * Helper component that renders a title representing the current network
 * configuration based on the provided network status
 */
const Title = ({ status }: TitleProps) => {
  const result = {
    // TRANSLATORS: Network summary title when no network has been configured
    [NetworkStatus.NOT_CONFIGURED]: _("Not configured"),
    // TRANSLATORS: Network summary title when connections are set up only for
    // installation and won't persist in the installed system
    [NetworkStatus.NO_PERSISTENT]: _("Installation only"),
    // [NetworkStatus.NO_PERSISTENT]: _("Not persistent"),
    // TRANSLATORS: Network summary title when using both automatic (DHCP) and manual configuration
    [NetworkStatus.MIXED]: _("Auto and manual"),
    // TRANSLATORS: Network summary title when using automatic configuration (DHCP)
    [NetworkStatus.AUTO]: _("Auto"),
    // TRANSLATORS: Network summary title when using manual/static IP configuration
    [NetworkStatus.MANUAL]: _("Manual"),
  };
  return result[status];
};

/**
 * Renders a summary of the network settings, providing a brief overview of the
 * network status and configuration.
 *
 * It displays the current network "mode" (e.g., Auto, Manual, etc.) and the
 * most relevant data (e.g., IP addresses), giving users a quick understanding
 * of the network setup before they dive into the section for more details.
 */
export default function NetworkDetailsItem() {
  const { status, persistentConnections } = useNetworkStatus();

  return (
    <Details.StackItem
      label={
        <Link to={NETWORK.root} variant="link" isInline>
          {_("Network")}
        </Link>
      }
      content={<Title status={status} />}
      description={<Description status={status} connections={persistentConnections} />}
    />
  );
}
