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

import React, { useState } from "react";
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
  Tab,
  Tabs,
  TabTitleText,
} from "@patternfly/react-core";
import { generatePath } from "react-router";
import { Link, Page } from "~/components/core";
import InstallationOnlySwitch from "./InstallationOnlySwitch";
import { Connection, Device } from "~/types/network";
import { connectionBindingMode, formatIp } from "~/utils/network";
import { NETWORK } from "~/routes/paths";
import { useNetworkDevices } from "~/queries/network";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import spacingStyles from "@patternfly/react-styles/css/utilities/Spacing/spacing";

/**
 * Returns a human-readable description of how a network connection is bound.
 */
const bindingModeFor = (connection: Connection) => {
  const bindingMode = connectionBindingMode(connection);
  switch (bindingMode) {
    case "none":
      return _("Connection is available to all devices.");
    case "iface":
      // TRANSLATORS: %s will be replaced by a network device name, like eth0 or enp1s0
      return sprintf(_("Connection is bound to device %s."), connection.iface);
    case "mac":
      // TRANSLATORS: %s will be replaced by MAC addrss, like 7C:D7:11:28:F5:40
      return sprintf(_("Connection is bound to MAC address %s."), connection.macAddress);
  }
};

const BindingSettings = ({ connection }: { connection: Connection }) => {
  return (
    <Page.Section
      title={_("Binding")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
      actions={
        <Link
          to={generatePath(NETWORK.editBindingSettings, {
            id: connection.id,
          })}
        >
          {_("Edit binding settings")}
        </Link>
      }
    >
      <Content>{bindingModeFor(connection)}</Content>
    </Page.Section>
  );
};

const DeviceDetails = ({ device }: { device: Device }) => {
  return (
    <DescriptionList
      key={device.name}
      aria-label={_("Device details")}
      isHorizontal
      className={spacingStyles.mSm}
    >
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
  const [active, setActive] = useState(0);
  const handleTabClick = (
    event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    tabIndex: number,
  ) => {
    setActive(tabIndex);
  };

  const connectedDevices = devices.filter(
    ({ connection: deviceConnectionId }) => deviceConnectionId === connection.id,
  );

  const none = connectedDevices.length === 0;
  const onlyOne = connectedDevices.length === 1;
  const multiple = connectedDevices.length > 1;

  return (
    <Page.Section
      title={onlyOne ? _("Connected device") : _("Connected devices")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
    >
      {none && _("No device is currently using this connection.")}
      {onlyOne && <DeviceDetails device={connectedDevices[0]} />}
      {multiple && (
        <Tabs
          activeKey={active}
          onSelect={handleTabClick}
          aria-label={_("Connected devices tabs")}
          role="region"
        >
          {connectedDevices.map((device, index) => (
            <Tab
              key={device.name}
              eventKey={index}
              title={<TabTitleText>{device.name}</TabTitleText>}
            >
              <DeviceDetails key={device.name} device={device} />
            </Tab>
          ))}
        </Tabs>
      )}
    </Page.Section>
  );
};

const ConnectionDetails = ({ connection }: { connection: Connection }) => {
  const gateways = [connection.gateway4, connection.gateway6];
  return (
    <Page.Section
      title={_("Settings")}
      pfCardProps={{ isPlain: false, isFullHeight: false }}
      actions={
        <Link to={generatePath(NETWORK.editConnection, { id: connection.id })}>
          {_("Edit connection settings")}
        </Link>
      }
    >
      <Stack hasGutter>
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
                {gateways.every((g) => isEmpty(g))
                  ? _("None set")
                  : gateways.map((g, i) => <FlexItem key={i}>{g}</FlexItem>)}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("IP Addresses")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                {isEmpty(connection.addresses)
                  ? _("None set")
                  : connection.addresses.map((ip, idx) => (
                      <FlexItem key={idx}>{formatIp(ip)}</FlexItem>
                    ))}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>{_("DNS")}</DescriptionListTerm>
            <DescriptionListDescription>
              <Flex direction={{ default: "column" }}>
                {isEmpty(connection.nameservers)
                  ? _("None set")
                  : connection.nameservers.map((dns, idx) => <FlexItem key={idx}>{dns}</FlexItem>)}
              </Flex>
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
        <Divider />
        <InstallationOnlySwitch connection={connection} />
        <Divider />
      </Stack>
    </Page.Section>
  );
};

export default function WiredConnectionDetails({ connection }: { connection: Connection }) {
  return (
    <Grid hasGutter>
      <GridItem md={6}>
        <Stack hasGutter>
          <ConnectionDetails connection={connection} />
        </Stack>
      </GridItem>
      <GridItem md={6} order={{ default: "1", md: "2" }}>
        <Stack hasGutter>
          <BindingSettings connection={connection} />
          <DevicesDetails connection={connection} />
        </Stack>
      </GridItem>
    </Grid>
  );
}
