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
import { Text } from "@patternfly/react-core";
import { Em, If, Section, SectionSkeleton } from "~/components/core";
import { useL10n } from "~/context/l10n";
import { _ } from "~/i18n";

const Content = ({ locales }) => {
  // Only considering the first locale.
  const locale = locales[0];

  // TRANSLATORS: %s will be replaced by a language name and territory, example:
  // "English (United States)".
  const [msg1, msg2] = _("The system will use %s as its default language.").split("%s");

  return (
    <Text>
      {msg1}<Em>{`${locale.id} (${locale.territory})`}</Em>{msg2}
    </Text>
  );
};

export default function L10nSection() {
  const { selectedLocales } = useL10n();

  const isLoading = selectedLocales.length === 0;

  return (
    <Section
      key="l10n-section"
      // TRANSLATORS: page section
      title={_("Localization")}
      loading={isLoading}
      icon="globe"
      path="/l10n"
      id="l10n"
    >
      <If
        condition={isLoading}
        then={<SectionSkeleton numRows={1} />}
        else={<Content locales={selectedLocales} />}
      />
    </Section>
  );
}
