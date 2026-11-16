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

import React from "react";
import { Content } from "@patternfly/react-core";
import Interpolate from "~/components/core/Interpolate";
import Link from "~/components/core/Link";
import Page from "~/components/layout/Page";
import WelcomeForm from "~/components/welcome/welcome-form/Form";
import { useProductInfo } from "~/hooks/model/config/product";
import { L10N } from "~/routes/paths";
import { _ } from "~/i18n";

/**
 * Tells what the settings apply to.
 *
 * Before a product is selected, the installer language and keyboard also become
 * the ones of the system to install. Once it is selected, the system keeps its
 * own, set on the localization page.
 */
const Intro = () => {
  const product = useProductInfo();

  if (!product) {
    return (
      <Content isEditorial>
        {_(
          // TRANSLATORS: introduction of the language and keyboard screen, the
          // first screen of the installer
          "These settings apply to this interface and to the system to install. You can change them later.",
        )}
      </Content>
    );
  }

  return (
    <Content isEditorial>
      <Interpolate
        sentence={_(
          // TRANSLATORS: introduction of the language and keyboard screen once a
          // product is selected. The text in square brackets [] links to the
          // localization settings of the system to install; keep the brackets
          // and translate it as the "Language and region" section title.
          "These settings apply to this interface. The system to install keeps its own, in [Language and region].",
        )}
      >
        {(text) => (
          <Link to={L10N.root} variant="link" isInline>
            {text}
          </Link>
        )}
      </Interpolate>
    </Content>
  );
};

/**
 * Screen for the installer language and keyboard.
 *
 * It is the first screen of a new installation, and the one the header
 * language and keyboard option leads to afterwards.
 */
export default function WelcomePage() {
  return (
    <Page
      // TRANSLATORS: title of the screen for the installer language and keyboard
      breadcrumbs={[{ label: _("Language and keyboard") }]}
      unlinkSummary
      hideL10nOptions
    >
      <WelcomeForm intro={<Intro />} />
    </Page>
  );
}
