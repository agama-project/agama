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
import Popup from "./Popup";

import { useInstallerClient } from "./context/installer";
import { useCancellablePromise } from "./utils";
import { formatIp } from "./client/network";

export default function TargetIpsPopup() {
  const client = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [connections, setConnections] = useState([]);
  const [hostname, setHostname] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    cancellablePromise(client.network.config()).then(config => {
      setConnections(config.connections);
      setHostname(config.hostname);
    });
  }, [client.network, cancellablePromise]);

  useEffect(() => {
    const onConnectionAdded = addedConnection => {
      setConnections(conns => [...conns, addedConnection]);
    };

    return client.network.listen("connectionAdded", onConnectionAdded);
  }, [client.network]);

  useEffect(() => {
    const onConnectionRemoved = connectionPath => {
      setConnections(conns => conns.filter(c => c.path !== connectionPath));
    };

    return client.network.listen("connectionRemoved", onConnectionRemoved);
  }, [client.network]);

  useEffect(() => {
    const onConnectionUpdated = updatedConnection => {
      setConnections(conns => {
        const newConnections = conns.filter(c => c.path !== updatedConnection.path);
        return [...newConnections, updatedConnection];
      });
    };

    return client.network.listen("connectionUpdated", onConnectionUpdated);
  }, [client.network]);

  if (connections.length === 0) return null;

  const ips = connections.flatMap(conn => conn.addresses.map(formatIp));
  const [firstIp] = ips;

  if (ips.length === 0) return null;

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <>
      <Button variant="link" onClick={open} isDisabled={ips.length === 1}>
        {firstIp} {hostname && <Text component="small">({hostname})</Text>}
      </Button>

      <Popup isOpen={isOpen} title="Ip Addresses">
        <List>
          {ips.map(ip => (
            <ListItem key={ip}>{ip}</ListItem>
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
