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
 * The names are kept short because they end up in the address bar, where they
 * compete for room with the path the user actually cares about.
 */

/** Sections currently expanded, as a set of tokens. */
const EXPANDED = "e";

/** Selected tab of the settings section. */
const SETTINGS_TAB = "st";

/** Selected tab of the result section. */
const RESULT_TAB = "rt";

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

export { EXPANDED, SETTINGS_TAB, RESULT_TAB, expandedToken, volumeGroupToken };
