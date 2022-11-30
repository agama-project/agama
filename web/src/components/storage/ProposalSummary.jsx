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

import {
  Button,
  Label,
  Text
} from "@patternfly/react-core";

export default function ProposalSummary({ proposal, onClick }) {
  const DeviceLabel = ({ device }) => {
    return (
      <Label isCompact>
        {device.label}
      </Label>
    );
  };

  const DeviceButton = ({ device, onClick }) => {
    return (
      <Button variant="link" onClick={onClick}>
        {device.label}
      </Button>
    );
  };

  const DeviceSummary = ({ device, onClick }) => {
    if (onClick) return <DeviceButton device={device} onClick={onClick} />;

    return <DeviceLabel device={device} />;
  };

  const device = proposal.availableDevices.find(d => d.id === proposal.candidateDevices[0]);

  if (!device) return <Text>Device not selected yet</Text>;

  const deviceSummary = <DeviceSummary device={device} onClick={onClick} />;

  return (
    <Text>
      Install using device {deviceSummary} and deleting all its content
    </Text>
  );
}
