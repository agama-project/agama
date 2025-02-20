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

// @ts-check

import { _ } from "~/i18n";
import { sprintf } from "sprintf-js";
import { StorageDevice } from "~/types/storage";

/*
 * Description of the device type.
 */
const typeDescription = (device: StorageDevice): string | undefined => {
  let type: string;

  switch (device.type) {
    case "multipath": {
      // TRANSLATORS: multipath device type
      type = _("Multipath");
      break;
    }
    case "dasd": {
      // TRANSLATORS: %s is replaced by the device bus ID
      type = sprintf(_("DASD %s"), device.busId);
      break;
    }
    case "md": {
      // TRANSLATORS: software RAID device, %s is replaced by the RAID level, e.g. RAID-1
      type = sprintf(_("Software %s"), device.level.toUpperCase());
      break;
    }
    case "disk": {
      if (device.sdCard) {
        type = _("SD Card");
      } else {
        const technology = device.transport || device.bus;
        type = technology
          ? // TRANSLATORS: %s is substituted by the type of disk like "iSCSI" or "SATA"
            sprintf(_("%s disk"), technology)
          : _("Disk");
      }
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
const contentDescription = (device: StorageDevice): string => {
  if (device.partitionTable) {
    const type = device.partitionTable.type.toUpperCase();
    const numPartitions = device.partitionTable.partitions.length;

    // TRANSLATORS: disk partition info, %s is replaced by partition table
    // type (MS-DOS or GPT), %d is the number of the partitions
    return sprintf(_("%s with %d partitions"), type, numPartitions);
  }

  if (!!device.model && device.model === device.description) {
    // TRANSLATORS: status message, no existing content was found on the disk,
    // i.e. the disk is completely empty
    return _("No content found");
  }

  if (device.description === "") return;

  return device.description;
};

export { typeDescription, contentDescription };
