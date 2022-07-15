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
import { useInstallerClient } from "./context/installer";
import Popup from "./Popup";
import { Button, List, ListItem, Text } from "@patternfly/react-core";

const initIpData = {
  addresses: [],
  hostname: ""
};

function formatIp(address, prefix) {
  return address + "/" + prefix;
}

export default function TargetIpsPopup() {
  const client = useInstallerClient();
  const [state, setState] = useState(initIpData);
  const [isOpen, setIsOpen] = useState(false);
  const { hostname, addresses } = state;

  useEffect(() => {
    client.network.config().then((data) => {
      setState(data);
    });
  }, [client.network]);

  const ips = addresses.map((addr) => formatIp(addr.address, addr.prefix));
  let label = ips[0];
  let title = "IP addresses";

  if (hostname) {
    label += ` (${hostname})`;
    title += ` for ${hostname}`;
  }

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  if (addresses.length === 0) return null;

  if (ips.length === 1) return <Text component="small" className="host-ip">{label}</Text>;

  return (
    <>
      <Button variant="link" onClick={open}>
        { label }
      </Button>

      <Popup
        isOpen={isOpen}
        title={title}
      >
        <List>
          { ips.map((ip) => <ListItem key={ip}>{ip}</ListItem>) }
        </List>
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>Close</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
