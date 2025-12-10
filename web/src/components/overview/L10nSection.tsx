/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Content } from "@patternfly/react-core";
import { useProposal } from "~/hooks/model/proposal/l10n";
import { useSystem } from "~/hooks/model/system/l10n";
import { _ } from "~/i18n";
import type { Locale } from "~/model/system/l10n";

export default function L10nSection() {
  const proposal = useProposal();
  const system = useSystem();
  const locale = proposal?.locale && system?.locales?.find((l: Locale) => l.id === proposal.locale);

  // TRANSLATORS: %s will be replaced by a language name and territory, example:
  // "English (United States)".
  const [msg1, msg2] = _("The system will use %s as its default language.").split("%s");

  return (
    <Content>
      <Content component="h3">{_("Localization")}</Content>
      <Content>
        <b>{locale ? `${msg1}${locale.id} (${locale.territory})${msg2}` : _("Not selected yet")}</b>
      </Content>
    </Content>
  );
}
