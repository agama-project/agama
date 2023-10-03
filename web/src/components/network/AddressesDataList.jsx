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
  DataListAction,
} from "@patternfly/react-core";

import { FormLabel } from "~/components/core";
import { IpAddressInput, IpPrefixInput } from "~/components/network";
import { _ } from "~/i18n";

let index = 0;

export default function AddressesDataList({
  addresses: originalAddresses,
  updateAddresses,
  allowEmpty = true
}) {
  const addresses = originalAddresses.map(addr => {
    const newAddr = addr;
    if (!newAddr.id) newAddr.id = index++;
    return newAddr;
  });

  const addAddress = () => {
    addresses.push({ address: "", prefix: "", id: index++ });
    updateAddresses(addresses);
  };

  const updateAddress = (id, field, value) => {
    const address = addresses.find(addr => addr.id === id);
    address[field] = value;
    updateAddresses(addresses);
  };

  const deleteAddress = id => {
    const addressIdx = addresses.findIndex(addr => addr.id === id);
    addresses.splice(addressIdx, 1);
    updateAddresses(addresses);
  };

  const renderAddress = ({ id, address, prefix }) => {
    const renderDeleteAction = () => {
      if (!allowEmpty && addresses.length === 1) return null;

      return (
        <DataListAction>
          <Button size="sm" variant="link" className="remove-link" onClick={() => deleteAddress(id)}>
            {/* TRANSLATORS: button label */}
            {_("Remove")}
          </Button>
        </DataListAction>
      );
    };

    const cells = [
      <DataListCell key={`address-${id}-address`}>
        <IpAddressInput
          defaultValue={address}
          onChange={value => updateAddress(id, "address", value)}
          // TRANSLATORS: input field name
          placeholder={_("IP Address")}
          aria-label={_("IP Address")}
        />
      </DataListCell>,
      <DataListCell key={`address-${id}-prefix`}>
        <IpPrefixInput
          defaultValue={prefix}
          onChange={value => updateAddress(id, "prefix", value)}
          // TRANSLATORS: input field name
          placeholder={_("Prefix length or netmask")}
          aria-label={_("Prefix length or netmask")}
        />
      </DataListCell>
    ];

    return (
      <DataListItem key={`address-${id}`}>
        <DataListItemRow>
          <DataListItemCells dataListCells={cells} />
          {renderDeleteAction()}
        </DataListItemRow>
      </DataListItem>
    );
  };

  // TRANSLATORS: button label
  const newAddressButtonText = addresses.length ? _("Add another address") : _("Add an address");

  return (
    <>
      <div className="split justify-between">
        <FormLabel isRequired={!allowEmpty}>{_("Addresses")}</FormLabel>
        <Button size="sm" variant="secondary" onClick={addAddress}>
          {newAddressButtonText}
        </Button>
      </div>
      <DataList isCompact gridBreakpoint="none" title={_("Addresses data list")}>
        {addresses.map(address => renderAddress(address))}
      </DataList>
    </>
  );
}
