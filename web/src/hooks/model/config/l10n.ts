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

import { useSuspenseQuery } from "@tanstack/react-query";
import { configQuery, extendedConfigQuery } from "~/hooks/model/config";
import type { Config } from "~/model/config";
import type * as L10n from "~/model/config/l10n";

const selectL10n = (data: Config | null): L10n.Config | null => data?.l10n;

/**
 * Returns the localization settings the user set, through the UI or an
 * installation profile.
 *
 * Locale, keymap and timezone can each be missing, and on a fresh boot all
 * three usually are. That does not mean Agama has no value for them: it always
 * resolves one. Use this hook to know what the user chose. To know what will be
 * installed, or to show a value on screen, use {@link useExtendedL10n}.
 */
function useL10n(): L10n.Config | null {
  const { data } = useSuspenseQuery({
    ...configQuery,
    select: selectL10n,
  });
  return data;
}

/**
 * Returns the localization settings Agama will install: what the user set, on
 * top of what the system provides. Locale, keymap and timezone are always
 * present.
 *
 * Prefer this over the localization proposal. Both hold the same three values
 * while the settings are valid, but the backend sends no proposal at all once
 * one of them is unknown. These settings are still there, bad value included,
 * so a view can show what is wrong.
 *
 * The ids are whatever was configured, so they may not match any entry in the
 * lists the system reports. Callers looking one up must handle finding nothing.
 */
function useExtendedL10n(): L10n.Config | null {
  const { data } = useSuspenseQuery({
    ...extendedConfigQuery,
    select: selectL10n,
  });
  return data;
}

export { useL10n, useExtendedL10n };
