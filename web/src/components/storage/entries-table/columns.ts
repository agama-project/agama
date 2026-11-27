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

/** The column names of the storage entries table. */
function columnName(column: "device" | "usedFor" | "existingData" | "actions"): TranslatedString {
  switch (column) {
    case "device":
      return _("Device");
    case "existingData":
      // TRANSLATORS: column with what happens to the data on each device: kept, shrunk or deleted
      return _("Actions on current content");
    case "usedFor":
      // TRANSLATORS: column with what the new system uses each device for
      return _("Used for");
    case "actions":
      return _("Actions");
  }
}

export { columnName };
