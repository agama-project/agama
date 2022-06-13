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
import { Button, Text } from "@patternfly/react-core";

const initIpData = {
  addresses: [],
  hostname: ""
};

function formatIp(address, prefix) {
  return address + "/" + prefix;
}

export default function TargetIpsPopup() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const client = useInstallerClient();
  const [state, setState] = useState(initIpData);
  const ips = state.addresses.map((addr) => formatIp(addr.address, addr.prefix));
  const firstIp = ips.length > 0 ? ips[0] : "";

  useEffect(() => {
    const config = async () => {
      const data = await client.network.config();
      setState({ ...state, ...data });
    };

    config();
  }, [client.network, state]);

  return (
    <>
      <Button variant="link" onClick={open}>
        { firstIp } ({state.hostname})
      </Button>

      <Popup
        isOpen={isOpen}
        title={state.hostname}
        aria-label="IP Addresses"
      >
        { ips.map((ip) => <Text key={ip}> {ip} </Text>) }
        <Popup.Actions>
          <Popup.Confirm onClick={close} autoFocus>Close</Popup.Confirm>
        </Popup.Actions>
      </Popup>
    </>
  );
}
