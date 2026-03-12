/*
 * Copyright (c) [2023-2026] SUSE LLC
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
import { Flex, Stack, Tab, Tabs, TabTitleText } from "@patternfly/react-core";
import { Link, NestedContent, Page } from "~/components/core";
import Text from "~/components/core/Text";
import Icon from "~/components/layout/Icon";
import NoPersistentConnectionsAlert from "~/components/network/NoPersistentConnectionsAlert";
import ConnectionsTable from "~/components/network/ConnectionsTable";
import DevicesTable from "~/components/network/DevicesTable";
import { useNetworkChanges, useSystem } from "~/hooks/model/system/network";
import { NETWORK } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Page component holding Network settings
 */
export default function NetworkPage() {
  useNetworkChanges();
  const { devices, state } = useSystem();
  const [tab, setTab] = useState("0");

  const handleTabClick = (e, v) => {
    setTab(v.toString());
  };

  return (
    <Page
      breadcrumbs={[{ label: _("Network") }]}
      progress={{ scope: "network", ensureRefetched: "system" }}
    >
      <Page.Content>
        <NoPersistentConnectionsAlert />

        <Tabs activeKey={tab} onSelect={handleTabClick} role="region">
          <Tab eventKey={"0"} title={<TabTitleText>{_("Connections")}</TabTitleText>}>
            <NestedContent margin="mxSm">
              <Stack hasGutter>
                <Text textStyle="textColorSubtle">
                  {_(
                    "Manage available connections, connect to Wi-Fi, or add a new connection. Switch to Devices to manage by device.",
                  )}
                </Text>
                <Page.Section
                  pfCardProps={{ isCompact: true, component: "div" }}
                  actions={
                    <>
                      <Link to={NETWORK.newConnection} variant="plain">
                        <Flex
                          gap={{ default: "gapXs" }}
                          alignItems={{ default: "alignItemsCenter" }}
                        >
                          <Icon name="add_circle" /> {_("Add connection")}
                        </Flex>
                      </Link>
                      {state.wirelessEnabled && (
                        <Link to={NETWORK.newWiFiConnection} variant="plain">
                          <Flex
                            gap={{ default: "gapSm" }}
                            alignItems={{ default: "alignItemsCenter" }}
                          >
                            <Icon name="wifi" /> {_("Connect to Wi-Fi network")}
                          </Flex>
                        </Link>
                      )}
                    </>
                  }
                >
                  <ConnectionsTable />
                </Page.Section>
              </Stack>
            </NestedContent>
          </Tab>
          <Tab eventKey={"1"} title={<TabTitleText>{_("Devices")}</TabTitleText>}>
            <NestedContent margin="mxSm">
              <Stack hasGutter>
                <Text textStyle="textColorSubtle">
                  {_(
                    "Browse available devices and configure their connections. Switch to Connections to manage by connection.",
                  )}
                </Text>
                <Page.Section pfCardProps={{ isCompact: true, component: "div" }}>
                  <DevicesTable devices={devices} />
                </Page.Section>
              </Stack>
            </NestedContent>
          </Tab>
        </Tabs>
      </Page.Content>
    </Page>
  );
}
