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
 * What each column of the list is called.
 *
 * The names are not drawn. A header strip sitting once at the top of a list of
 * eight devices labels columns that have scrolled away from it, and the first
 * column already carries every row's own name. They are read out instead, to
 * whoever is meeting the list one cell at a time, which is who needs them.
 */
function columnName(column: "entry" | "content" | "actions"): TranslatedString {
  switch (column) {
    case "entry":
      // TRANSLATORS: names the column of the list holding what each entry of
      // the installation is called.
      return _("Device");
    case "content":
      // TRANSLATORS: names the column of the list saying what the installer
      // will put on each entry, or what it will use it for.
      return _("Content");
    case "actions":
      // TRANSLATORS: names the column of the list saying what the installation
      // costs whatever is already on each entry.
      return _("Actions");
  }
}

export { columnName };
