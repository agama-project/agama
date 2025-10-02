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
import { useProposal } from "~/queries/proposal";
import { useSystem } from "~/queries/system";
import { _ } from "~/i18n";

export default function L10nSection() {
  const { localization: l10nProposal } = useProposal();
  const { localization: l10n } = useSystem();
  const locale = l10nProposal.locale && l10n.locales.find((l) => l.id === l10nProposal.locale);

  // TRANSLATORS: %s will be replaced by a language name and territory, example:
  // "English (United States)".
  const [msg1, msg2] = _("The system will use %s as its default language.").split("%s");

  return (
    <Content>
      <Content component="h3">{_("Localization")}</Content>
      <Content>
        <b>
          {locale ? `${msg1}${locale.name} (${locale.territory})${msg2}` : _("Not selected yet")}
        </b>
      </Content>
    </Content>
  );
}
