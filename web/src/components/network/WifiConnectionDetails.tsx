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
import { generatePath } from "react-router";
import { Link, Page } from "~/components/core";
import InstallationOnlySwitch from "./InstallationOnlySwitch";
import { Device, WifiNetwork } from "~/types/network";
import { NETWORK } from "~/routes/paths";
import { formatIp } from "~/utils/network";
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
          <DescriptionListTerm>{_("Signal strength")}</DescriptionListTerm>
          <DescriptionListDescription>{network.strength}%</DescriptionListDescription>
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

const DeviceDetails = ({ device }: { device: Device }) => {
  if (!device) return;

  return (
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
  );
};

const IpDetails = ({ device, settings }: { device: Device; settings: WifiNetwork["settings"] }) => {
  if (!device) return;

  return (
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
          <DescriptionListTerm>{_("Mode")}</DescriptionListTerm>
          <DescriptionListDescription>
            <Flex direction={{ default: "column" }}>
              <FlexItem>
                {_("IPv4")} {settings.method4}
              </FlexItem>
              <FlexItem>
                {_("IPv6")} {settings.method6}
              </FlexItem>
            </Flex>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Addresses")}</DescriptionListTerm>
          <DescriptionListDescription>
            <Flex direction={{ default: "column" }}>
              {device.addresses.map((ip, idx) => (
                <FlexItem key={idx}>{formatIp(ip)}</FlexItem>
              ))}
            </Flex>
          </DescriptionListDescription>
        </DescriptionListGroup>
        <DescriptionListGroup>
          <DescriptionListTerm>{_("Gateway")}</DescriptionListTerm>
          <DescriptionListDescription>
            <Flex direction={{ default: "column" }}>
              <FlexItem>{device.gateway4}</FlexItem>
              <FlexItem>{device.gateway6}</FlexItem>
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
  );
};

export default function WifiConnectionDetails({ network }: { network: WifiNetwork }) {
  if (!network) return;

  return (
    <Grid hasGutter>
      <GridItem md={6} order={{ default: "2", md: "1" }} rowSpan={3}>
        <IpDetails device={network.device} settings={network.settings} />
      </GridItem>
      <GridItem md={6} order={{ default: "1", md: "2" }}>
        <Stack hasGutter>
          <DeviceDetails device={network.device} />
          <NetworkDetails network={network} />
        </Stack>
      </GridItem>
      <GridItem md={6} order={{ default: "3" }}>
        <InstallationOnlySwitch connection={network.settings} />
      </GridItem>
    </Grid>
  );
}
