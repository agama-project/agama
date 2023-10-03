/*
 * Copyright (c) [2022] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
  DataListAction
} from "@patternfly/react-core";

import { FormLabel } from "~/components/core";
import { IpAddressInput } from "~/components/network";
import { _ } from "~/i18n";

let index = 0;

export default function DnsDataList({ servers: originalServers, updateDnsServers }) {
  const servers = originalServers.map(dns => {
    if (!dns.id) dns.id = index++;
    return dns;
  });

  const addServer = () => {
    servers.push({ address: "", id: index++ });
    updateDnsServers(servers);
  };

  const updateServer = (id, field, value) => {
    const server = servers.find(dns => dns.id === id);
    server[field] = value;
    updateDnsServers(servers);
  };

  const deleteServer = id => {
    const serverIdx = servers.findIndex(dns => dns.id === id);
    servers.splice(serverIdx, 1);
    updateDnsServers(servers);
  };

  const renderDns = ({ id, address }) => {
    return (
      <DataListItem key={`address-${id}`}>
        <DataListItemRow>
          <DataListItemCells dataListCells={[
            <DataListCell key={`dns-${id}-address`}>
              <IpAddressInput
                defaultValue={address}
                onChange={value => updateServer(id, "address", value)}
                // TRANSLATORS: input field name
                placeholder={_("Server IP")}
                aria-label={_("Server IP")}
              />
            </DataListCell>
          ]}
          />
          <DataListAction>
            <Button size="sm" variant="link" className="remove-link" onClick={() => deleteServer(id)}>
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
    <>
      <div className="split justify-between">
        <FormLabel>{_("DNS")}</FormLabel>
        <Button size="sm" variant="secondary" onClick={addServer}>
          {newDnsButtonText}
        </Button>
      </div>
      <DataList isCompact gridBreakpoint="none" title="Addresses data list">
        {servers.map(server => renderDns(server))}
      </DataList>
    </>
  );
}
