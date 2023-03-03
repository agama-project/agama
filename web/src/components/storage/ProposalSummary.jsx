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

import React from "react";
import { Text } from "@patternfly/react-core";
import { Em } from "~/components/core";

export default function ProposalSummary({ proposal }) {
  const DeviceLabel = ({ device }) => {
    return (
      <Em>{device.label}</Em>
    );
  };

  const device = proposal.availableDevices.find(d => d.id === proposal.candidateDevices[0]);

  if (!device) return <Text>Device not selected yet</Text>;

  return (
    <Text>
      Install using device <DeviceLabel device={device} /> and deleting all its content
    </Text>
  );
}
