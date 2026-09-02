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

import { useExtendedL10n } from "~/hooks/model/config/l10n";
import { useSystem } from "~/hooks/model/system/l10n";

import type { Keymap, Locale, Timezone } from "~/model/system/l10n";

/**
 * Everything the localization form needs in one shape: the option lists to
 * choose from (from the system) and the ids currently in use (from the extended
 * configuration). Aggregated here so the form can be wrapped in
 * `withFrozenQuery` and the lists/values do not shift mid-edit.
 *
 * The ids come from the configuration rather than from the proposal because the
 * backend drops the whole proposal as soon as one of the three values is
 * unknown. Reading the configuration keeps the two valid fields preselected so
 * the user only has to correct the one that is actually wrong.
 */
type L10nData = {
  locales: Locale[];
  keymaps: Keymap[];
  timezones: Timezone[];
  locale?: string;
  keymap?: string;
  timezone?: string;
};

function useL10nData(): L10nData {
  const system = useSystem();
  const config = useExtendedL10n();

  return {
    locales: system?.locales ?? [],
    keymaps: system?.keymaps ?? [],
    timezones: system?.timezones ?? [],
    locale: config?.locale,
    keymap: config?.keymap,
    timezone: config?.timezone,
  };
}

export { useL10nData };
export type { L10nData };
