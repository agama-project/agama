/*
 * Copyright (c) [2024] SUSE LLC
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

import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { compact } from "~/utils";
import type { storage as system } from "~/model/system";

const driveTypeDescription = (device: system.Device): string => {
  if (device.drive.type === "multipath") {
    // TRANSLATORS: multipath device type
    return _("Multipath");
  }

  if (device.drive.type === "dasd") {
    // TRANSLATORS: %s is replaced by the device bus ID
    return sprintf(_("DASD %s"), device.drive.busId);
  }

  if (device.drive.info.sdCard) {
    return _("SD Card");
  }

  const technology = device.drive.transport || device.drive.bus;
  return technology
    ? // TRANSLATORS: %s is substituted by the type of disk like "iSCSI" or "SATA"
      sprintf(_("%s disk"), technology)
    : _("Disk");
};

/*
 * Description of the device type.
 */
const typeDescription = (device: system.Device): string | undefined => {
  let type: string;

  switch (device.class) {
    case "mdRaid": {
      // TRANSLATORS: software RAID device, %s is replaced by the RAID level, e.g. RAID-1
      type = sprintf(_("Software %s"), device.md.level.toUpperCase());
      break;
    }
    case "drive": {
      type = driveTypeDescription(device);
    }
  }

  return type;
};

/*
 * Description of the device.
 *
 * TODO: there is a lot of room for improvement here, but first we would need
 * device.description (comes from YaST) to be way more granular
 */
const contentDescription = (device: system.Device): string => {
  if (device.partitionTable) {
    const type = device.partitionTable.type.toUpperCase();
    const numPartitions = device.partitions.length;

    // TRANSLATORS: disk partition info, %s is replaced by partition table
    // type (MS-DOS or GPT), %d is the number of the partitions
    return sprintf(_("%s with %d partitions"), type, numPartitions);
  }

  const model = device.drive?.model;
  if (!!model && model === device.description) {
    // TRANSLATORS: status message, no existing content was found on the disk,
    // i.e. the disk is completely empty
    return _("No content found");
  }

  if (device.description === "") return;

  return device.description;
};

/*
 * Labels of the filesystems included at the device
 */
const filesystemLabels = (device: system.Device): string[] => {
  if (device.partitionTable) {
    return compact(device.partitions.map((p) => p.filesystem?.label));
  }

  const label = device.filesystem?.label;
  return label ? [label] : [];
};

export { typeDescription, contentDescription, filesystemLabels };
