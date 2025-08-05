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
  Content,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Divider,
  Flex,
  FlexItem,
  Grid,
  GridItem,
  Stack,
} from "@patternfly/react-core";
import { Link, NestedContent, Page } from "~/components/core";
import InstallationOnlySwitch from "./InstallationOnlySwitch";
import { Connection, Device } from "~/types/network";
import { connectionBindingMode, formatIp } from "~/utils/network";
import { NETWORK } from "~/routes/paths";
import { useNetworkDevices } from "~/queries/network";
import { generateEncodedPath } from "~/utils";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

const BINDING_MODES = {
  none: _("to any interface"),
  mac: _("by MAC address"),
  iface: _("by interface name"),
};

const BindingSettings = ({ connection }: { connection: Connection }) => {
  const bindingMode = connectionBindingMode(connection);
  const bindingInfo = bindingMode === "iface" ? connection.iface : connection.macAddress;

  return (
    <Page.Section
      title={_("Binding settings")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
      actions={
        <Link
          to={generateEncodedPath(NETWORK.editBindingSettings, {
            id: connection.id,
          })}
        >
          {_("Edit binding settings")}
        </Link>
      }
    >
      <Content isEditorial>
        {bindingMode === "none"
          ? sprintf(_("Connection is bind %s."), BINDING_MODES[bindingMode])
          : sprintf(_("Connection is bind %s to %s."), BINDING_MODES[bindingMode], bindingInfo)}
      </Content>
    </Page.Section>
  );
};

const DeviceDetails = ({ device }: { device: Device }) => {
  return (
    <DescriptionList key={device.name} aria-label={_("Device details")} isHorizontal>
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
  );
};

const DevicesDetails = ({ connection }: { connection: Connection }) => {
  const devices = useNetworkDevices();

  const connectedDevices = devices.filter(
    ({ connection: deviceConnectionId }) => deviceConnectionId === connection.id,
  );

  return (
    <Page.Section
      title={_("Connected devices")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
    >
      <NestedContent>
        <Stack hasGutter>
          {connectedDevices.map((device, index) => (
            <React.Fragment key={device.name}>
              <DeviceDetails key={device.name} device={device} />
              {index < connectedDevices.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </Stack>
      </NestedContent>
    </Page.Section>
  );
};

const IpDetails = ({ connection, device }: { connection: Connection; device: Device }) => {
  if (!device) return;

  return (
    <Page.Section
      title={_("IP settings")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
      actions={
        <Link to={generateEncodedPath(NETWORK.editConnection, { id: device.connection })}>
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
                {_("IPv4")} {connection.method4}
              </FlexItem>
              <FlexItem>
                {_("IPv6")} {connection.method6}
              </FlexItem>
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
  );
};

export default function WiredConnectionDetails({ connection }: { connection: Connection }) {
  const devices = useNetworkDevices();

  const device = devices.find(
    ({ connection: deviceConnectionId }) => deviceConnectionId === connection.id,
  );

  return (
    <Grid hasGutter>
      <GridItem md={6} order={{ default: "2", md: "1" }} rowSpan={3}>
        <IpDetails device={device} connection={connection} />
      </GridItem>
      <GridItem md={6} order={{ default: "1", md: "2" }}>
        <Stack hasGutter>
          <BindingSettings connection={connection} />
          <DevicesDetails connection={connection} />
        </Stack>
      </GridItem>
      <GridItem md={6} order={{ default: "3" }}>
        <InstallationOnlySwitch connection={connection} />
      </GridItem>
    </Grid>
  );
}
