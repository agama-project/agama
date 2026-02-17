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
import { IPv4, IPv6 } from "ipaddr.js";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import Link from "~/components/core/Link";
import { NETWORK } from "~/routes/paths";
import { useIpAddresses } from "~/hooks/model/system/network";
import { _, n_ } from "~/i18n";

/**
 * Displays a formatted list of IP addresses from connected devices.
 *
 * Shows up to two IP addresses (one IPv4 and one IPv6 when available) in a
 * compact format. If there are additional addresses beyond the first two,
 * displays a "X more" link that navigates to the network page where all
 * addresses can be viewed.
 *
 * Display formats:
 *   - Single IP: "192.168.1.1"
 *   - Two IPs: "192.168.1.1 and fe80::1"
 *   - With extras: "192.168.1.1, fe80::1 and 2 more" (where "2 more" is a
 *     clickable link)
 */
export default function FormattedIPsList() {
  const addresses = useIpAddresses({ formatted: true });
  let firstIPv4: string | undefined;
  let firstIPv6: string | undefined;
  const rest: string[] = [];

  // Iterate over the addresses to find firstIPv4, firstIPv6, and the rest
  for (const address of addresses) {
    if (IPv4.isValid(address) && !firstIPv4) {
      firstIPv4 = address;
    } else if (IPv6.isValid(address) && !firstIPv6) {
      firstIPv6 = address;
    } else {
      rest.push(address);
    }
  }

  if (!isEmpty(rest)) {
    let text: string;
    let params: (string | number)[];

    if (firstIPv4 && firstIPv6) {
      // TRANSLATORS: Displays both IPv4 and IPv6 addresses with count of
      // additional IPs (e.g., "192.168.122.237, fe80::5054:ff:fe46:2af9 and 1
      // more"). %1$s is the IPv4 address, %2$s is the IPv6 address, and %3$d
      // is the number of remaining IPs. The text wrapped in square brackets []
      // is displayed as a link. Keep the brackets to ensure the link works
      // correctly.
      text = n_("%1$s, %2$s and [%3$d more]", "%1$s, %2$s and [%3$d more]", rest.length);
      params = [firstIPv4, firstIPv6, rest.length];
    } else {
      // TRANSLATORS: Displays a single IP address (either IPv4 or IPv6) with
      // count of additional IPs (e.g., "192.168.122.237 and [2 more]"). %1$s is
      // the IP address and %2$d is the number of remaining IPs. The text
      // wrapped in square brackets [] is displayed as a link. Keep the brackets
      // to ensure the link works correctly.
      text = n_("%1$s and [%2$d more]", "%1$s and [%2$d more]", rest.length);
      params = [firstIPv4 || firstIPv6, rest.length];
    }

    const [textStart, link, textEnd] = sprintf(text, ...params).split(/[[\]]/);

    return (
      <>
        {textStart}{" "}
        <Link to={NETWORK.root} variant="link" isInline>
          {link}
        </Link>{" "}
        {textEnd}
      </>
    );
  }

  if (firstIPv4 && firstIPv6) {
    // TRANSLATORS: Displays first IPv4 and IPv6 when both are present.
    // %1$s is the first IPv4 and %2$s is the first IPv6.
    return sprintf(_("%1$s and %2$s"), firstIPv4, firstIPv6);
  }

  return firstIPv4 || firstIPv6;
}
