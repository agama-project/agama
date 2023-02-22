/*
 * Copyright (c) [2023] SUSE LLC
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
import { Label } from "@patternfly/react-core";
import { Section, SectionSkeleton } from "~/components/core";
import { ConnectionTypes, NetworkEventTypes } from "~/client/network";
import { useInstallerClient } from "~/context/installer";
import { formatIp } from "~/client/network/utils";

export default function NetworkSection() {
  const { network: client } = useInstallerClient();
  const [initialized, setInitialized] = useState(false);
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    client.setUp().then(() => setInitialized(true));
  }, [client]);

  useEffect(() => {
    if (initialized) {
      setConnections(client.activeConnections());
    }
  }, [client, initialized]);

  useEffect(() => {
    return client.onNetworkEvent(({ type, payload }) => {
      switch (type) {
        case NetworkEventTypes.ACTIVE_CONNECTION_ADDED: {
          setConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_UPDATED: {
          setConnections(conns => {
            const newConnections = conns.filter(c => c.id !== payload.id);
            return [...newConnections, payload];
          });
          break;
        }

        case NetworkEventTypes.ACTIVE_CONNECTION_REMOVED: {
          setConnections(conns => conns.filter(c => c.id !== payload.id));
          break;
        }
      }
    });
  });

  const Content = () => {
    if (!initialized) return <SectionSkeleton />;

    const activeConnections = connections.filter(c => [ConnectionTypes.WIFI, ConnectionTypes.ETHERNET].includes(c.type));

    if (activeConnections.length === 0) return "No network connections detected";

    const summary = activeConnections.map(connection => (
      <Label key={connection.id} isCompact>{connection.name} - {connection.addresses.map(formatIp)}</Label>
    ));

    return (
      <>
        <div>{activeConnections.length} connection(s) set:</div>
        <div className="split wrapped">{summary}</div>
      </>
    );
  };

  return (
    <Section
      title="Network"
      icon="settings_ethernet"
      loading={!initialized}
      path="/network"
    >
      <Content />
    </Section>
  );
}
