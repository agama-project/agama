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
import { useInstallerClient } from "~/context/installer";
import { formatIp } from "~/client/network/utils";
import { _, n_ } from "~/i18n";

export default function NetworkSection() {
  const { network: client } = useInstallerClient();
  const [devices, setDevices] = useState(undefined);

  useEffect(() => {
    if (devices !== undefined) return;

    client.devices().then(setDevices);
  }, [client, devices]);

  const deviceSummary = (device) => {
    if ((device?.addresses || []).length === 0) {
      return (
        <Em key={device.name}>{device.name}</Em>
      );
    } else {
      return (
        <Em key={device.name}>{device.name} - {device.addresses.map(formatIp).join(", ")}</Em>
      );
    }
  };

  const Content = () => {
    if (devices === undefined) return <SectionSkeleton />;

    if (devices.length === 0) return _("No network devices detected");

    const summary = devices.map(deviceSummary);

    const msg = sprintf(
      // TRANSLATORS: header for the list of active network connections,
      // %d is replaced by the number of active connections
      n_("%d device set:", "%d devices set:", devices.length),
      devices.length
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
      loading={!devices}
      path="/network"
      id="network"
    >
      <Content />
    </Section>
  );
}
