/*
 * Copyright (c) [2026] SUSE LLC
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
import { sprintf } from "sprintf-js";
import { baseName, formattedPath, filesystemLabel } from "~/components/storage/utils";
import { useFlattenDevices as useSystemDevices } from "~/hooks/model/system/storage";
import { _ } from "~/i18n";
import type { Entry } from "~/components/storage/device-details/entry";

export type ExistingContentProps = {
  entry: Entry;
  /** Whether the installation deletes what is on the device. */
  isDeleted?: boolean;
};

/**
 * Says what is on a device today and whether the installation deletes it.
 */
export default function ExistingContent({ entry, isDeleted = false }: ExistingContentProps) {
  const systemDevices = useSystemDevices();
  const device = entry.device;

  if (device?.filesystem) {
    const type = filesystemLabel(device.filesystem.type);

    if (isDeleted) {
      return (
        <p>
          {sprintf(
            // TRANSLATORS: %s is a filesystem type like "Ext4" or "Btrfs"
            _("%s file system: it will be deleted and its data lost."),
            type,
          )}
        </p>
      );
    }

    return (
      <p>
        {
          // TRANSLATORS: %s is a filesystem type like "Ext4" or "Btrfs"
          sprintf(_("%s file system."), type)
        }
      </p>
    );
  }

  const group =
    device && systemDevices.find((d) => d.volumeGroup?.physicalVolumes.includes(device.sid));
  if (group) {
    if (isDeleted) {
      return (
        <p>
          {sprintf(
            // TRANSLATORS: %s is the name of an LVM volume group, like "system"
            _("LVM physical volume: the whole volume group %s will be deleted and its data lost."),
            formattedPath(baseName(group.name)),
          )}
        </p>
      );
    }

    return (
      <p>
        {sprintf(
          // TRANSLATORS: %s is the name of an LVM volume group, like "system"
          _("LVM physical volume for the volume group %s."),
          formattedPath(baseName(group.name)),
        )}
      </p>
    );
  }

  const raid = device && systemDevices.find((d) => d.md?.devices.includes(device.sid));
  if (raid) {
    if (isDeleted) {
      return (
        <p>
          {sprintf(
            // TRANSLATORS: %s is the name of an MD RAID, like "md0".
            _("Part of a RAID: the whole RAID %s will be deleted and its data lost."),
            formattedPath(baseName(raid.name)),
          )}
        </p>
      );
    }

    return (
      <p>
        {sprintf(
          // TRANSLATORS: %s is the name of an MD RAID, like "md0".
          _("Part of the RAID %s."),
          formattedPath(baseName(raid.name)),
        )}
      </p>
    );
  }

  return <p>{_("No content detected.")}</p>;
}
