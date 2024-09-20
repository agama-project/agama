/*
 * Copyright (c) [2022-2024] SUSE LLC
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

/*
 * Based in the previous work done for cockpit-wicked project, see
 *   - https://github.com/openSUSE/cockpit-wicked
 *   - https://github.com/openSUSE/cockpit-wicked/blob/master/src/components/AddressesDataList.js
 */

import React from "react";
import {
  Button,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListItemCells,
  DataListCell,
  DataListAction,
  Flex,
  Stack,
} from "@patternfly/react-core";

import { FormLabel } from "~/components/core";
import IpAddressInput from "~/components/network/IpAddressInput";
import { _ } from "~/i18n";

type DNS = {
  id?: number;
  address: string;
};

let index = 0;

export default function DnsDataList({
  servers: originalServers,
  updateDnsServers,
}: {
  servers: DNS[];
  updateDnsServers: (servers: DNS[]) => void;
}) {
  const servers = originalServers.map((dns: DNS) => {
    if (!dns.id) dns.id = index++;
    return dns;
  });

  const addServer = () => {
    servers.push({ address: "", id: index++ });
    updateDnsServers(servers);
  };

  const updateServer = (id: number, field: string, value: string) => {
    const server = servers.find((dns) => dns.id === id);
    server[field] = value;
    updateDnsServers(servers);
  };

  const deleteServer = (id: number) => {
    const serverIdx = servers.findIndex((dns) => dns.id === id);
    servers.splice(serverIdx, 1);
    updateDnsServers(servers);
  };

  const renderDns = ({ id, address }: DNS) => {
    return (
      <DataListItem key={`address-${id}`}>
        <DataListItemRow>
          <DataListItemCells
            dataListCells={[
              <DataListCell key={`dns-${id}-address`}>
                <IpAddressInput
                  // TRANSLATORS: input field name
                  label={_("Server IP")}
                  defaultValue={address}
                  onChange={(_, value: string) => updateServer(id, "address", value)}
                />
              </DataListCell>,
            ]}
          />
          {/** @ts-expect-error: https://github.com/patternfly/patternfly-react/issues/9823 */}
          <DataListAction id={`delete-dns${id}`}>
            <Button
              size="sm"
              variant="link"
              className="remove-link"
              onClick={() => deleteServer(id)}
            >
              {/* TRANSLATORS: button label */}
              {_("Remove")}
            </Button>
          </DataListAction>
        </DataListItemRow>
      </DataListItem>
    );
  };

  // TRANSLATORS: button label
  const newDnsButtonText = servers.length ? _("Add another DNS") : _("Add DNS");

  return (
    <Stack hasGutter>
      <Flex justifyContent={{ default: "justifyContentSpaceBetween" }}>
        <FormLabel>{_("DNS")}</FormLabel>
      </Flex>
      {/** FIXME: try to use an aria-labelledby instead when PatternFly permits it (or open a bug report) */}
      <DataList isCompact aria-label="DNS data list">
        {servers.map((server) => renderDns(server))}
      </DataList>
      <Flex>
        <Button size="sm" variant="secondary" onClick={addServer}>
          {newDnsButtonText}
        </Button>
      </Flex>
    </Stack>
  );
}
