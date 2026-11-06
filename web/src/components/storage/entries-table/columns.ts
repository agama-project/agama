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

/**
 * What each column of the list is called, as its header shows it.
 */
function columnName(column: "device" | "usedFor" | "existingData" | "actions"): TranslatedString {
  switch (column) {
    case "device":
      // TRANSLATORS: names the column of the list holding what each entry of
      // the installation is called.
      return _("Device");
    case "existingData":
      // TRANSLATORS: names the column of the list saying what happens to the
      // data already on each device: kept, shrunk or deleted.
      return _("Existing data");
    case "usedFor":
      // TRANSLATORS: names the column of the list saying what the system being
      // installed uses each device for, such as its mount points.
      return _("Used for");
    case "actions":
      // TRANSLATORS: names the column of the list holding the menu of what can
      // be done to each entry of the installation.
      return _("Actions");
  }
}

export { columnName };
