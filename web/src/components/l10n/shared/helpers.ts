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
 * Helpers shared by the localization fields.
 */

import { dateTimeFormat } from "~/utils";

/**
 * Current UTC offset of a time zone as a label like "UTC+1" or "UTC-3:30",
 * derived from the zone id. The backend does not send the offset, so it is read
 * from the same Intl machinery used for the local time, which means it reflects
 * DST. Returns an empty string for an unknown zone.
 */
export function timezoneUtcOffset(timezone: string, date: Date = new Date()): string {
  try {
    const parts = dateTimeFormat(timezone, { timeZoneName: "shortOffset" }).formatToParts(date);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    // Intl yields a "GMT±H[:MM]" label (just "GMT" at zero); present it as "UTC".
    return name.replace("GMT", "UTC");
  } catch {
    return "";
  }
}
