/*
 * Copyright (c) [2024-2025] SUSE LLC
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
import { useDevices } from "~/queries/storage";
import { useConfigModel } from "~/queries/storage/config-model";
import DriveEditor from "~/components/storage/DriveEditor";
import VolumeGroupEditor from "~/components/storage/VolumeGroupEditor";
import { List, ListItem } from "@patternfly/react-core";

export default function ConfigEditor() {
  const model = useConfigModel({ suspense: true });
  const devices = useDevices("system", { suspense: true });

  return (
    <List isPlain>
      {model.volumeGroups.map((vg, i) => {
        return (
          <ListItem key={`vg-${i}`}>
            <VolumeGroupEditor vg={vg} />
          </ListItem>
        );
      })}
      {model.drives.map((drive, i) => {
        const device = devices.find((d) => d.name === drive.name);

        /**
         * @fixme Make DriveEditor to work when the device is not found (e.g., after disabling
         * a iSCSI device).
         */
        if (device === undefined) return null;

        return (
          <ListItem key={`drive-${i}`}>
            <DriveEditor drive={drive} driveDevice={device} />
          </ListItem>
        );
      })}
    </List>
  );
}
