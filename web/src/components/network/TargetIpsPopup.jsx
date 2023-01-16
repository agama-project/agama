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

import React, { useEffect, useState } from "react";
import { Button, List, ListItem, Text } from "@patternfly/react-core";

import { noop, useCancellablePromise } from "@/utils";
import { useInstallerClient } from "@context/installer";
import { formatIp } from "@client/network/utils";

import { Popup } from "@components/core";

export default function TargetIpsPopup({ onClickCallback = noop }) {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [addresses, setAddresses] = useState([]);
  const [initialized, setInitialized] = useState(false);
  const [hostname, setHostname] = useState();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    cancellablePromise(client.network.setUp()).then(() => setInitialized(true));
  }, [client.network, cancellablePromise]);

  useEffect(() => {
    if (!initialized) return;

    const refreshState = () => {
      setAddresses(client.network.addresses());
      setHostname(client.network.settings().hostname);
    };

    refreshState();
    return client.network.onNetworkEvent(() => {
      refreshState();
    });
  }, [client.network, initialized]);

  if (addresses.length === 0) return null;
  const [firstIp] = addresses;

  const open = () => {
    setIsOpen(true);
    onClickCallback();
  };

  const close = () => setIsOpen(false);

  return (
    <>
      <Button variant="link" onClick={open} isDisabled={addresses.length === 1}>
        {formatIp(firstIp)} {hostname && <Text component="small">({hostname})</Text>}
      </Button>

      <Popup isOpen={isOpen} title="IP Addresses">
        <List>
          {addresses.map((ip, index) => (
            <ListItem key={index}>{formatIp(ip)}</ListItem>
          ))}
        </List>
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>
            Close
          </Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
