/*
 * Copyright (c) [2024-2026] SUSE LLC
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

import React from "react";
import { Button, Popover, List, ListItem } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";
import { deviceSize, formattedPath } from "~/components/storage/utils";
import { Icon } from "~/components/layout";
import { useConfigModel } from "~/hooks/model/storage/config-model";
import configModel from "~/model/storage/config-model";
import type { Storage as Proposal } from "~/model/proposal";
import type { ConfigModel } from "~/model/storage/config-model";

// FIXME: there is too much logic here. This is one of those cases that should be considered
// when restructuring the hooks and queries.
const useReusedPartition = (name: string): ConfigModel.Partition | undefined => {
  const config = useConfigModel();

  if (!config || !name) return;

  const volumes = configModel.devices(config).flatMap((d) => configModel.device.volumes(d));
  return volumes.find((v) => v.name === name && configModel.volume.isUsed(v));
};

/**
 * Info about the device.
 * @component
 */
const DeviceInfoContent = ({ device }: { device: Proposal.Device }) => {
  const minSize = device.block?.shrinking?.minSize;

  const reused = useReusedPartition(device.name);
  if (reused) {
    if (!reused.mountPath) return _("The device will be used by the new system.");

    // TRANSLATORS: %s is a mount path like "/home".
    return sprintf(_("The device will be mounted at %s."), formattedPath(reused.mountPath));
  }

  if (minSize) {
    const recoverable = device.block.size - minSize;
    return sprintf(
      _("Up to %s can be recovered by shrinking the device."),
      deviceSize(recoverable),
    );
  }

  const reasons = device.block?.shrinking?.reasons || [];

  return (
    <>
      {_("The device cannot be shrunk:")}
      <List>
        {reasons.map((reason: string, idx: number) => (
          <ListItem key={idx}>{reason}</ListItem>
        ))}
      </List>
    </>
  );
};

/**
 * Button to show a popup with info about the device.
 * @component
 *
 * @param {object} props
 * @param {Proposal.Device} props.device
 */
export default function ActionInfo({ device }: { device: Proposal.Device }) {
  return (
    <Popover headerContent={device.name} bodyContent={<DeviceInfoContent device={device} />}>
      <Button
        aria-label={sprintf(_("Show information about %s"), device.name)}
        variant="plain"
        icon={<Icon name="info" />}
      />
    </Popover>
  );
}
