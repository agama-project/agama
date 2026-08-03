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

/**
 * Names and tokens the storage pages use to keep their UI state in the URL.
 *
 * Gathering them here keeps the vocabulary in one place: the generic hooks in
 * `~/hooks/use-search-param-state` know nothing about storage, and the
 * components know only which name to ask for.
 *
 * Each name says what it holds, so an address can be read and edited by hand.
 * The values these carry are composed, though, so they are meant to be read
 * rather than written: a column and a direction, or a set of tokens. Table
 * filters need nothing here, since `useFilterParams` names each param after the
 * filter itself.
 */

/**
 * Names repeat across pages on purpose: two storage pages never share an
 * address, so each can spend the same name on what matters to it. The prefix
 * tells them apart here, and does not reach the URL.
 */

/** Proposal page: sections currently expanded, as a set of tokens. */
const EXPANDED = "expanded";

/** Proposal page: selected tab of the settings section. */
const SETTINGS_TAB = "settingsTab";

/** Proposal page: selected tab of the result section. */
const RESULT_TAB = "resultTab";

/** DASD page: sorted column and direction, as in `sortBy=channel:desc`. */
const DASD_SORT = "sortBy";

/** zFCP page: sorted column and direction. */
const ZFCP_SORT = "sortBy";

/** iSCSI page: sorted column and direction. */
const ISCSI_SORT = "sortBy";

/**
 * Token identifying an expandable section of a device.
 *
 * Built from the collection and the position of the device, which is how the
 * storage pages already address a device.
 *
 * @example
 * expandedToken("drives", 0); // "d0"
 */
function expandedToken(collection: "drives" | "mdRaids", index: number): string {
  return `${collection[0]}${index}`;
}

/**
 * Token identifying the logical volumes section of a volume group.
 *
 * @example
 * volumeGroupToken("system"); // "vgsystem"
 */
function volumeGroupToken(vgName: string): string {
  return `vg${vgName}`;
}

export {
  EXPANDED,
  SETTINGS_TAB,
  RESULT_TAB,
  DASD_SORT,
  ZFCP_SORT,
  ISCSI_SORT,
  expandedToken,
  volumeGroupToken,
};
