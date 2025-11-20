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
import { Alert, Button, DataList, Flex } from "@patternfly/react-core";
import Text from "~/components/core/Text";
import DriveEditor from "~/components/storage/DriveEditor";
import VolumeGroupEditor from "~/components/storage/VolumeGroupEditor";
import MdRaidEditor from "~/components/storage/MdRaidEditor";
import { useDevices } from "~/hooks/api/system/storage";
import { useReset } from "~/hooks/api/config/storage";
import ConfigureDeviceMenu from "./ConfigureDeviceMenu";
import { useModel } from "~/hooks/storage/model";
import { _ } from "~/i18n";

const NoDevicesConfiguredAlert = () => {
  const reset = useReset();
  const title = _("No devices configured yet");
  // TRANSLATORS: %s will be replaced by a "reset to default" button
  const body = _(
    "Use actions below to set up your devices or click %s to start from scratch with the default configuration.",
  );
  const [bodyStart, bodyEnd] = body.split("%s");

  return (
    <Alert title={title} variant="custom" isInline>
      {bodyStart}{" "}
      <Button variant="link" onClick={() => reset()} isInline>
        <Text isBold>
          {
            // TRANSLATORS: label for a button
            _("reset to defaults")
          }
        </Text>
      </Button>{" "}
      {bodyEnd}
    </Alert>
  );
};

/**
 * @fixme Adapt components (DriveEditor, MdRaidEditor, etc) to receive a list name and an index
 * instead of a device object. Each component will retrieve the device from the model if needed.
 *
 * That will allow to:
 * * Simplify the model types (list and listIndex properties are not needed).
 * * All the components (DriveEditor, PartitionPage, etc) work in a similar way. They receive a
 *   list and an index and each component retrieves the device from the model if needed.
 * * The components always have all the needed info for generating an url.
 * * The partitions and logical volumes can also be referenced by an index, so it opens the door
 *   to have partitions and lvs without a mount path.
 *
 * These changes will be done once creating partitions without a mount path is needed (e.g., for
 * manually creating physical volumes).
 */
export default function ConfigEditor() {
  const model = useModel();
  const devices = useDevices();
  const drives = model.drives;
  const mdRaids = model.mdRaids;
  const volumeGroups = model.volumeGroups;

  if (!drives.length && !mdRaids.length && !volumeGroups.length) {
    return <NoDevicesConfiguredAlert />;
  }

  return (
    <>
      <DataList aria-label={_("[FIXME]")} isCompact className="storage-structure">
        {volumeGroups.map((vg, i) => {
          return <VolumeGroupEditor key={`vg-${i}`} vg={vg} />;
        })}
        {mdRaids.map((raid, i) => {
          const device = devices.find((d) => d.name === raid.name);

          return <MdRaidEditor key={`md-${i}`} raid={raid} raidDevice={device} />;
        })}
        {drives.map((drive, i) => {
          const device = devices.find((d) => d.name === drive.name);

          /**
           * @fixme Make DriveEditor to work when the device is not found (e.g., after disabling
           * a iSCSI device).
           */
          if (device === undefined) return null;

          return <DriveEditor key={`drive-${i}`} drive={drive} driveDevice={device} />;
        })}
      </DataList>
      <Flex>
        <ConfigureDeviceMenu />
      </Flex>
    </>
  );
}
