/*
 * Copyright (c) [2025] SUSE LLC
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
import { Flex } from "@patternfly/react-core";
import Details from "~/components/core/Details";
import Link from "~/components/core/Link";
import { useProposal } from "~/hooks/model/proposal/l10n";
import { useSystem } from "~/hooks/model/system/l10n";
import { L10N } from "~/routes/paths";
import { sprintf } from "sprintf-js";
import { _ } from "~/i18n";

export default function L10nDetailsItem() {
  const l10nProposal = useProposal();
  const l10nSystem = useSystem();
  const locale =
    l10nProposal.locale && l10nSystem.locales.find((l) => l.id === l10nProposal.locale);
  const keymap =
    l10nProposal.keymap && l10nSystem.keymaps.find((k) => k.id === l10nProposal.keymap);
  const timezone =
    l10nProposal.timezone && l10nSystem.timezones.find((t) => t.id === l10nProposal.timezone);

  return (
    <Details.Item label={_("Language and region")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapSm" }}>
        <Link to={L10N.root} variant="link" isInline>
          {locale.language} - {locale.territory}
        </Link>
        <small>
          {sprintf(_("Using %s keyboard and %s timezone"), keymap.description, timezone.id)}
        </small>
      </Flex>
    </Details.Item>
  );
}
