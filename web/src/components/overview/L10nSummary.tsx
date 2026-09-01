/*
 * Copyright (c) [2025-2026] SUSE LLC
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

import React from "react";
import { isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import Summary from "~/components/core/Summary";
import Link from "~/components/core/Link";
import { useExtendedL10n } from "~/hooks/model/config/l10n";
import { useSystem } from "~/hooks/model/system/l10n";
import { useIssues } from "~/hooks/model/issue";
import { L10N } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Renders the selected language, as its name and territory.
 *
 * Falls back to the configured locale id when the system reports no locale
 * matching it, which is what happens when the id is unknown or misspelled.
 */
const Value = () => {
  const config = useExtendedL10n();
  const system = useSystem();
  const locale = system?.locales?.find((l) => l.id === config?.locale);

  if (!locale) return config?.locale;

  // TRANSLATORS: Summary of the selected language and territory.
  // %1$s is the language name (e.g. "Spanish").
  // %2$s is the territory/region name (e.g. "Spain").
  return sprintf(_("%1$s (%2$s)"), locale.language, locale.territory);
};

/**
 * Renders the selected keyboard layout and time zone.
 *
 * The keyboard falls back to its configured id when the system reports no
 * layout matching it, which is what happens when the id is unknown or
 * misspelled. Time zones are always shown by id, since that is how users know
 * them.
 */
const Description = () => {
  const config = useExtendedL10n();
  const system = useSystem();
  const keymap = system?.keymaps?.find((k) => k.id === config?.keymap);

  // TRANSLATORS: Additional details shown under the language selection.
  // %1$s is the keyboard layout name (e.g. "Spanish").
  // %2$s is the time zone identifier (e.g. "Atlantic/Canary").
  return sprintf(
    _("%1$s keyboard - %2$s timezone"),
    keymap?.description ?? config?.keymap,
    config?.timezone,
  );
};

/**
 * Displays a summary of the selected localization settings.
 *
 * Shows the currently configured language, keyboard layout, and time zone in a
 * consistent summary format. The title is a link that navigates to the
 * localization configuration page.
 *
 * When the localization settings are reported as invalid, the summary says so
 * instead of describing them, matching how the other summaries of the overview
 * behave. The details are left out on purpose: the localization page is where
 * users find out what is wrong and fix it.
 */
export default function L10nSummary() {
  const issues = useIssues("l10n");
  const hasIssues = !isEmpty(issues);

  return (
    <Summary
      hasIssues={hasIssues}
      icon="translate"
      title={
        <Link to={L10N.root} variant="link" isInline>
          {_("Language and region")}
        </Link>
      }
      value={hasIssues ? _("Invalid settings") : <Value />}
      description={hasIssues ? null : <Description />}
    />
  );
}
