/*
 * Copyright (c) [2023] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of version 2 of the GNU General Public License as published
 * by the Free Software Foundation.
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
import { TextContent, Text, TextVariants } from "@patternfly/react-core";
import { Em } from "~/components/core";
import { _ } from "~/i18n";
import { localesQuery, configQuery } from "~/queries/l10n";
import { useQuery } from "@tanstack/react-query";

export default function L10nSection() {
  const { isPending: isLocalesPending, data: locales } = useQuery(localesQuery());
  const { isPending: isConfigPending, data: config } = useQuery(configQuery());

  if (isLocalesPending || isConfigPending) return;

  const locale = locales.find((l) => l.id === config?.locales[0]);

  // TRANSLATORS: %s will be replaced by a language name and territory, example:
  // "English (United States)".
  const [msg1, msg2] = _("The system will use %s as its default language.").split("%s");

  return (
    <TextContent>
      <Text component={TextVariants.h3}>{_("Localization")}</Text>
      <Text>
        {msg1}
        <Em>{`${locale.name} (${locale.territory})`}</Em>
        {msg2}
      </Text>
    </TextContent>
  );
}
