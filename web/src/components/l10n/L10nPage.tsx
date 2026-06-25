/*
 * Copyright (c) [2022-2026] SUSE LLC
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
import { Button } from "@patternfly/react-core";
import InstallerL10nOptions from "~/components/core/InstallerL10nOptions";
import Interpolate from "~/components/core/Interpolate";
import Page from "~/components/core/Page";
import Text from "~/components/core/Text";
import L10nForm from "~/components/l10n/l10n-form/Form";
import { localConnection } from "~/utils";
import { _ } from "~/i18n";

const InstallerL10nSettingsInfo = () => {
  const info = localConnection()
    ? // TRANSLATORS: Text used for helping user to set the interface language
      // and keymap. Text in the square brackets [] is the link to the header
      // option that opens those settings; please keep the brackets.
      _(
        "These are the settings for the product to install. The installer language and keyboard layout can be adjusted using the [language and keyboard] option at the top bar.",
      )
    : // TRANSLATORS: Text used for helping user to set the interface language.
      // Text in the square brackets [] is the link to the header option that
      // opens those settings; please keep the brackets.
      _(
        "These are the settings for the product to install. The installer language can be adjusted using the [language] option at the top bar.",
      );

  return (
    <Text textStyle="textColorSubtle">
      <Interpolate sentence={info}>
        {(text) => (
          <InstallerL10nOptions
            toggle={({ onClick }) => (
              <Button variant="link" isInline onClick={onClick}>
                {text}
              </Button>
            )}
          />
        )}
      </Interpolate>
    </Text>
  );
};

/**
 * Page for configuring localization.
 */
export default function L10nPage() {
  return (
    <Page breadcrumbs={[{ label: "Language and region" }]}>
      <Page.Content>
        <InstallerL10nSettingsInfo />
        <L10nForm />
      </Page.Content>
    </Page>
  );
}
