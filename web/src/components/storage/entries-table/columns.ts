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

import { _, TranslatedString } from "~/i18n";
import type { DetailsCollection } from "~/components/storage/shared/use-device-details";

/**
 * What each column of the list is called, as its header shows it.
 */
function columnName(
  column: "type" | "device" | "existingData" | "newSystem" | "actions",
): TranslatedString {
  switch (column) {
    case "type":
      // TRANSLATORS: names the column of the list saying what kind of device
      // each entry is, such as a disk or a volume group.
      return _("Type");
    case "device":
      // TRANSLATORS: names the column of the list holding what each entry of
      // the installation is called.
      return _("Device");
    case "existingData":
      // TRANSLATORS: names the column of the list saying what happens to the
      // data already on each entry: kept, shrunk, deleted or reused.
      return _("Existing data");
    case "newSystem":
      // TRANSLATORS: names the column of the list saying what the system being
      // installed will put on each entry, or what it will use it for.
      return _("New system");
    case "actions":
      // TRANSLATORS: names the column of the list holding the menu of what can
      // be done to each entry of the installation.
      return _("Actions");
  }
}

/**
 * What kind of device an entry is, as the type column reads it.
 */
function typeName(collection: DetailsCollection): TranslatedString {
  switch (collection) {
    case "volumeGroups":
      // TRANSLATORS: kind of device in the list of the installation devices:
      // an LVM volume group, abbreviated.
      return _("VG");
    case "mdRaids":
      // TRANSLATORS: kind of device in the list of the installation devices:
      // a software RAID.
      return _("RAID");
    case "drives":
      // TRANSLATORS: kind of device in the list of the installation devices:
      // a disk.
      return _("Disk");
  }
}

export { columnName, typeName };
