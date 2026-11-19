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
 * The time zone that best goes with the territory of the installer language.
 *
 * A frontend workaround until the backend provides it: langtable ranks time
 * zones per territory, but the installer does not expose that ranking yet. For
 * territories with several zones, the main one.
 */

import type { Timezone } from "~/model/system/l10n";

/** Time zones for each territory, best first, as their ids may vary. */
const TIMEZONES_FOR_TERRITORY: Record<string, string[]> = {
  BR: ["America/Sao_Paulo"],
  CN: ["Asia/Shanghai"],
  DE: ["Europe/Berlin"],
  ES: ["Europe/Madrid"],
  FR: ["Europe/Paris"],
  GE: ["Asia/Tbilisi"],
  ID: ["Asia/Jakarta"],
  IT: ["Europe/Rome"],
  JP: ["Asia/Tokyo"],
  RU: ["Europe/Moscow"],
  SE: ["Europe/Stockholm"],
  TW: ["Asia/Taipei"],
  UA: ["Europe/Kyiv", "Europe/Kiev"],
  US: ["America/New_York"],
};

/**
 * The time zone for the territory of the given installer language (e.g.
 * "es-ES"), among the available ones, or undefined when there is no match.
 */
export function timezoneFor(language: string, timezones: Timezone[]): string | undefined {
  const territory = language.split("-")[1];
  const available = new Set(timezones.map((t) => t.id));
  return TIMEZONES_FOR_TERRITORY[territory]?.find((id) => available.has(id));
}
