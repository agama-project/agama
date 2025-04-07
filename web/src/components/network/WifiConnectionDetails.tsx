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
import { generatePath } from "react-router-dom";
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Stack,
} from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { Device, WifiNetwork } from "~/types/network";
import { isEmpty } from "~/utils";
import { formatIp } from "~/utils/network";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

const NetworkDetails = ({ network }: { network: WifiNetwork }) => {
  return (
    <Page.Section title={_("Network")} pfCardProps={{ isPlain: false, isFullHeight: false }}>
      <DescriptionList aria-label={_("Network details")} isHorizontal>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("SSID")}</DescriptionListTerm>
          <DescriptionListDescription>{network.ssid}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Signal")}</DescriptionListTerm>
          <DescriptionListDescription>{network.strength}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
          <DescriptionListDescription>{network.status}</DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Security")}</DescriptionListTerm>
          <DescriptionListDescription>{network.security}</DescriptionListDescription>
        </DescriptionListGroup>
      </DescriptionList>
    </Page.Section>
  );
};

// FIXME:
// - should we use utils/network#connectionAddresses here?
// - should we present IPv4 and IPv6 separated as it is done with method and
// gateway
// - fix the device.method -> disabled bug
// - Choose one style for rendering v4 and v6 stuff: the one used in method or
// the other used in gateway
// - check the "Change configuration" link. device.connection is the
// network.ssid while in wlan the connection id is the interface (?)
const DeviceDetails = ({ device }: { device: Device }) => {
  if (!device) return "FIXME";

  return (
    <>
      <Page.Section title={_("Device")} pfCardProps={{ isPlain: false, isFullHeight: false }}>
        <DescriptionList aria-label={_("Connection details")} isHorizontal>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("Interface")}</DescriptionListTerm>
            <DescriptionListDescription>{device.name}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
            <DescriptionListDescription>{device.state}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("MAC")}</DescriptionListTerm>
            <DescriptionListDescription>{device.macAddress}</DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </Page.Section>
    </>
  );
};

const IpDetails = ({ device }: { device: Device }) => {
  if (!device) return "FIXME";

  return (
    <>
      <Page.Section
        title={_("IP settings")}
        pfCardProps={{ isPlain: false, isFullHeight: false }}
        actions={
          <Link to={generatePath(NETWORK.editConnection, { id: device.connection })}>
            {_("Edit")}
          </Link>
        }
      >
        <DescriptionList isHorizontal>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IPv4 Mode")}</DescriptionListTerm>
            <DescriptionListDescription>{device.method4}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IPv6 Mode")}</DescriptionListTerm>
            <DescriptionListDescription>{device.method6}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IPv4 Gateway")}</DescriptionListTerm>
            <DescriptionListDescription>{device.gateway4}</DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IPv6 Gateway")}</DescriptionListTerm>
            <DescriptionListDescription>
              {isEmpty(device.gateway6) ? _("None") : device.gateway6}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IP Addresses")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                {device.addresses.map((ip, idx) => (
                  <FlexItem key={idx}>{formatIp(ip)}</FlexItem>
                ))}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("DNS")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                {device.nameservers.map((dns, idx) => (
                  <FlexItem key={idx}>{dns}</FlexItem>
                ))}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("Routes")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                {device.routes4.map((route, idx) => (
                  <FlexItem key={idx}>{formatIp(route.destination)}</FlexItem>
                ))}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </Page.Section>
    </>
  );
};

export default function WifiConnectionDetails({ network }: { network: WifiNetwork }) {
  // TODO: display connection details (wireless and IP settings)
  // TODO: remove, at least, the forget button
  //
  if (!network) return "FIXME";
  if (isEmpty(network.settings)) return;

  return (
    <Grid hasGutter>
      <GridItem md={6}>
        <IpDetails device={network.device} />
      </GridItem>
      <GridItem md={6}>
        <Stack hasGutter>
          <NetworkDetails network={network} />
          <DeviceDetails device={network.device} />
        </Stack>
      </GridItem>
    </Grid>
  );
}
