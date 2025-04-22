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
  FormGroup,
} from "@patternfly/react-core";

import IpAddressInput from "~/components/network/IpAddressInput";
import IpPrefixInput from "~/components/network/IpPrefixInput";
import { _ } from "~/i18n";
import { IPAddress } from "~/types/network";

let index = 0;

type Address = IPAddress & { id?: number };

export default function AddressesDataList({
  addresses: originalAddresses,
  updateAddresses,
  allowEmpty = true,
}: {
  /** The initial collection of IP addresses */
  addresses: Address[];
  /** A callback to be called for updating the IP addresses collection */
  updateAddresses: (addresses: Address[]) => void;
  /** Whether the component allows reaching an empty addresses collection */
  allowEmpty?: boolean;
}) {
  const addresses = originalAddresses.map((addr) => {
    const newAddr = addr;
    if (!newAddr.id) newAddr.id = index++;
    return newAddr;
  });

  const addAddress = () => {
    addresses.push({ address: "", prefix: "", id: index++ });
    updateAddresses(addresses);
  };

  const updateAddress = (id: number, field: string, value: string) => {
    const address = addresses.find((addr) => addr.id === id);
    address[field] = value;
    updateAddresses(addresses);
  };

  const deleteAddress = (id: number) => {
    const addressIdx = addresses.findIndex((addr) => addr.id === id);
    addresses.splice(addressIdx, 1);
    updateAddresses(addresses);
  };

  const renderAddress = ({ id, address, prefix }: Address) => {
    const renderDeleteAction = () => {
      if (!allowEmpty && addresses.length === 1) return null;
      const buttonId = `delete-address-${id}-button`;

      return (
        /** @ts-expect-error: https://github.com/patternfly/patternfly-react/issues/9823 */
        <DataListAction id={`delete-address-${id}`}>
          <Button
            id={buttonId}
            size="sm"
            variant="link"
            className="remove-link"
            onClick={() => deleteAddress(id)}
          >
            {/* TRANSLATORS: button label */}
            {_("Remove")}
          </Button>
        </DataListAction>
      );
    };

    const cells = [
      <DataListCell key={`address-${id}-address`}>
        <IpAddressInput
          // TRANSLATORS: input field name
          label={_("IP Address")}
          defaultValue={address}
          onChange={(_, value: string) => updateAddress(id, "address", value)}
        />
      </DataListCell>,
      <DataListCell key={`address-${id}-prefix`}>
        <IpPrefixInput
          // TRANSLATORS: input field name
          label={_("Prefix length or netmask")}
          defaultValue={prefix}
          onChange={(_, value: string) => updateAddress(id, "prefix", value)}
        />
      </DataListCell>,
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
    <FormGroup isRequired={!allowEmpty} label={_("Addresses")}>
      <Flex
        direction={{ default: "column" }}
        alignItems={{ default: "alignItemsFlexStart" }}
        gap={{ default: "gapMd" }}
      >
        {/** FIXME: try to use an aria-labelledby instead when PatternFly permits it (or open a bug report) */}
        <DataList isCompact aria-label={_("Addresses data list")}>
          {addresses.map((address) => renderAddress(address))}
        </DataList>
        <Button size="sm" variant="secondary" onClick={addAddress}>
          {newAddressButtonText}
        </Button>
      </Flex>
    </FormGroup>
  );
}
