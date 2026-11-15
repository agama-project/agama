/*
 * Copyright (c) [2026] SUSE LLC
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

import React, { useEffect, useRef, useState } from "react";
import { isEmpty, sift } from "radashi";
import { sprintf } from "sprintf-js";
import { Button, Flex, Popover, Stack } from "@patternfly/react-core";
import { generatePath, useLocation } from "react-router";
import { IPv4, IPv6 } from "ipaddr.js";
import Link from "~/components/core/Link";
import Text from "~/components/core/Text";
import VisualTooltip from "~/components/core/VisualTooltip";
import Icon from "~/components/layout/Icon";
import {
  isConnected,
  networkIndicatorIcon,
  networkIndicatorInfo,
} from "~/components/network/network-indicator";
import { useAnnounce } from "~/context/announcer";
import { useStatus } from "~/hooks/model/status";
import { useSystem } from "~/hooks/model/system";
import { NetworkSystem } from "~/types/network";
import { NETWORK } from "~/routes/paths";
import { n_, _ } from "~/i18n";

import type {
  NetworkIndicatorInfo,
  NetworkIndicatorState,
} from "~/components/network/network-indicator";

/** The accessible name of the button, carrying the state. */
const stateName = (state: NetworkIndicatorState) => {
  switch (state.kind) {
    case "wifi":
      // TRANSLATORS: accessible name of the network button in the header. %s
      // is the Wi-Fi network name.
      return sprintf(_("Network: connected to Wi-Fi %s"), state.ssid);
    case "cable":
      // TRANSLATORS: accessible name of the network button in the header
      return _("Network: connected by cable");
    case "offline":
      // TRANSLATORS: accessible name of the network button in the header
      return _("Network: not connected");
    case "disabled":
      // TRANSLATORS: accessible name of the network button in the header
      return _("Network: networking is off");
  }
};

/** The title of the popover for the state. */
const stateTitle = (state: NetworkIndicatorState) => {
  switch (state.kind) {
    case "wifi":
      // TRANSLATORS: title of the network popover when connected to a Wi-Fi network
      return _("Connected over Wi-Fi");
    case "cable":
      // TRANSLATORS: title of the network popover when connected through a cable
      return _("Connected by cable");
    case "offline":
      // TRANSLATORS: title of the network popover when there is no connection
      return _("Not connected");
    case "disabled":
      // TRANSLATORS: title of the network popover when networking is disabled
      return _("Networking is off");
  }
};

type ConnectionDetailsProps = {
  state: NetworkIndicatorState;
  /** Whether the rest of the addresses can be reached in the connection details. */
  linksDetails: boolean;
};

/**
 * The connection in use, by its Wi-Fi network or its device, and its
 * addresses, one per line: the first IPv4 and IPv6 ones, and how many more
 * there are, which the connection details list.
 */
const ConnectionDetails = ({ state, linksDetails }: ConnectionDetailsProps) => {
  if (state.kind !== "wifi" && state.kind !== "cable") return null;

  const addresses = state.addresses.map((a) => a.address);
  const shown = sift([
    addresses.find((a) => IPv4.isValid(a)),
    addresses.find((a) => IPv6.isValid(a)),
  ]);
  const more = addresses.length - shown.length;
  const moreText = sprintf(
    // TRANSLATORS: in the network popover, below the addresses shown. %d is
    // how many other addresses the connection has.
    n_("%d more", "%d more", more),
    more,
  );

  return (
    <Stack>
      <Text isBold>{state.kind === "wifi" ? state.ssid : state.device}</Text>
      {!isEmpty(addresses) && (
        <Flex gap={{ default: "gapSm" }} flexWrap={{ default: "nowrap" }}>
          <Text textStyle="textColorSubtle">
            {
              // TRANSLATORS: label of the network addresses of the connection
              _("IPs")
            }
          </Text>
          <Stack>
            {shown.map((address) => (
              <span key={address}>{address}</span>
            ))}
            {more > 0 &&
              (linksDetails && state.connection ? (
                <Link
                  to={generatePath(NETWORK.connection.details, { id: state.connection })}
                  variant="link"
                  isInline
                >
                  {moreText}
                </Link>
              ) : (
                <span>{moreText}</span>
              ))}
          </Stack>
        </Flex>
      )}
    </Stack>
  );
};

/** How many Wi-Fi networks are around, besides the one in use, if any. */
const wifiNetworksText = ({ state, wifiNetworks }: NetworkIndicatorInfo) => {
  if (!wifiNetworks) return undefined;
  if (state.kind === "wifi")
    return sprintf(
      // TRANSLATORS: in the network popover. %d is a number of networks.
      n_("%d other Wi-Fi network available", "%d other Wi-Fi networks available", wifiNetworks),
      wifiNetworks,
    );
  return sprintf(
    // TRANSLATORS: in the network popover. %d is a number of networks.
    n_("%d Wi-Fi network available", "%d Wi-Fi networks available", wifiNetworks),
    wifiNetworks,
  );
};

/**
 * The network state in the header, like the icon of a desktop panel: Wi-Fi
 * bars by signal strength, a cable, or not connected. It opens a popover with
 * the connection (its Wi-Fi network or its device) and its addresses, the
 * Wi-Fi networks around, and the ways to connect or to change the settings.
 *
 * Only while configuring are those ways offered; during and after the
 * installation it tells the state only. Screen reader users hear when the
 * connection is lost or back, not about signal changes.
 *
 * It tells whether the machine is connected, not whether it reaches the
 * internet.
 */
export default function NetworkIndicator() {
  const network = useSystem()?.network;
  const { stage } = useStatus();
  const announce = useAnnounce();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { key: locationKey } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  // Nothing to tell until the installer reports the network.
  const hasNetwork = !!network?.devices && !!network?.state;
  const info = networkIndicatorInfo(
    hasNetwork
      ? NetworkSystem.fromApi({ connections: [], accessPoints: [], ...network })
      : new NetworkSystem(),
  );
  const { state } = info;
  const connected = isConnected(state);
  const wasConnected = useRef(connected);
  const isConfiguring = stage === "configuring";

  useEffect(() => {
    if (wasConnected.current === connected) return;
    wasConnected.current = connected;
    announce(
      connected
        ? // TRANSLATORS: announced to screen reader users when the network comes back
          _("Network connected")
        : // TRANSLATORS: announced to screen reader users when the network goes away
          _("Network connection lost"),
    );
  }, [connected, announce]);

  // Any link in the popover navigates, even to the page already shown: close it
  // on the way.
  useEffect(() => setIsOpen(false), [locationKey]);

  if (!hasNetwork) return null;

  const name = stateName(state);
  const wifiText = wifiNetworksText(info);
  const offersWifi = isConfiguring && !!info.wifiNetworks;

  const body = (
    <Stack hasGutter>
      <ConnectionDetails state={state} linksDetails={isConfiguring} />
      {wifiText && <Text>{wifiText}</Text>}
      {state.kind === "offline" && !wifiText && isConfiguring && (
        <Text>
          {
            // TRANSLATORS: in the network popover, when there is no connection
            // and no Wi-Fi network around
            _("Plug in a cable or check the network settings.")
          }
        </Text>
      )}
    </Stack>
  );

  const footer = isConfiguring && (
    <Flex gap={{ default: "gapMd" }}>
      {offersWifi && (
        <Link to={NETWORK.wifi.new} variant="link" isInline>
          {/* TRANSLATORS: link in the network popover to join a Wi-Fi network */}
          {_("Connect to Wi-Fi network")}
        </Link>
      )}
      <Link to={NETWORK.root} variant="link" isInline>
        {
          // TRANSLATORS: link in the network popover to the network page
          _("Network settings")
        }
      </Link>
    </Flex>
  );

  return (
    <>
      <VisualTooltip content={name}>
        <Button
          ref={triggerRef}
          variant="plain"
          aria-label={name}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
        >
          <Icon name={networkIndicatorIcon(info)} isMiddleAligned />
        </Button>
      </VisualTooltip>
      <Popover
        triggerRef={triggerRef}
        // TRANSLATORS: accessible name of the popover with the network state
        aria-label={_("Network")}
        headerContent={stateTitle(state)}
        bodyContent={body}
        footerContent={footer}
        position="bottom-end"
        appendTo={() => document.body}
        isVisible={isOpen}
        shouldOpen={() => setIsOpen(true)}
        shouldClose={() => setIsOpen(false)}
      />
    </>
  );
}
