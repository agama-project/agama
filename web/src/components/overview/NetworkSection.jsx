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
import { sprintf } from "sprintf-js";

import { Em, Section, SectionSkeleton } from "~/components/core";
import { ConnectionTypes } from "~/client/network";
import { useInstallerClient } from "~/context/installer";
import { formatIp } from "~/client/network/utils";
import { _, n_ } from "~/i18n";

export default function NetworkSection() {
  const { network: client } = useInstallerClient();
  const [connections, setConnections] = useState(undefined);

  useEffect(() => {
    if (connections !== undefined) return;

    client.connections().then(setConnections);
  }, [client, connections]);

  const Content = () => {
    if (connections === undefined) return <SectionSkeleton />;

    if (connections.length === 0) return _("No network connections detected");

    const summary = connections.map(connection => (
      <Em key={connection.id}>{connection.id} - {connection.addresses.map(formatIp).join(", ")}</Em>
    ));

    const msg = sprintf(
      // TRANSLATORS: header for the list of active network connections,
      // %d is replaced by the number of active connections
      n_("%d connection set:", "%d connections set:", connections.length),
      connections.length
    );

    return (
      <>
        <div>{msg}</div>
        <div className="split wrapped">{summary}</div>
      </>
    );
  };

  return (
    <Section
      // TRANSLATORS: page section title
      title={_("Network")}
      icon="settings_ethernet"
      loading={!connections}
      path="/network"
      id="network"
    >
      <Content />
    </Section>
  );
}
