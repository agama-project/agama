/*
 * Copyright (c) [2022-2025] SUSE LLC
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
import { Button, Content, Grid, GridItem } from "@patternfly/react-core";
import { InstallerOptions, Link, Page } from "~/components/core";
import { L10N as PATHS } from "~/routes/paths";
import { localConnection } from "~/utils";
import { useSystem, useProposal } from "~/hooks/api";
import { _ } from "~/i18n";

const InstallerL10nSettingsInfo = () => {
  const info = localConnection()
    ? // TRANSLATORS: Text used for helping user to set the interface language
      // and keymap from product localization options. Text in the square brackets [] is
      // used for the link to open the settings panel, please keep the brackets.
      _(
        "These are the settings for the product to install. The installer language and keyboard layout can be adjusted via the [settings panel] accessible from the top bar.",
      )
    : // TRANSLATORS: Text used for helping user to set the interface language
      // from product localization options. Text in the square brackets [] is used
      // for the link to open the settings panel, please keep the brackets.
      _(
        "These are the settings for the product to install. The installer language can be adjusted via the [settings panel] accessible from the top bar.",
      );

  const [infoStart, infoLink, infoEnd] = info.split(/[[\]]/);

  return (
    <small>
      {infoStart}{" "}
      <InstallerOptions
        toggle={({ onClick }) => (
          <Button variant="link" isInline onClick={onClick}>
            {infoLink}
          </Button>
        )}
      />
      {infoEnd}
    </small>
  );
};

// FIXME: re-evaluate the need of "Thing not selected yet"

/**
 * Page for configuring localization.
 */
export default function L10nPage() {
  // FIXME: retrieve selection from config when ready
  const { l10n: l10nProposal } = useProposal();
  const { l10n: l10nSystem } = useSystem();
  console.log(l10nProposal);

  const locale =
    l10nProposal.locale && l10nSystem.locales.find((l) => l.id === l10nProposal.locale);
  const keymap =
    l10nProposal.keymap && l10nSystem.keymaps.find((k) => k.id === l10nProposal.keymap);
  const timezone =
    l10nProposal.timezone && l10nSystem.timezones.find((t) => t.id === l10nProposal.timezone);

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Localization")}</Content>
      </Page.Header>

      <Page.Content>
        <Grid hasGutter>
          <GridItem md={4}>
            <Page.Section
              title={_("Language")}
              actions={
                <Link to={PATHS.localeSelection} isPrimary={!locale}>
                  {locale ? _("Change") : _("Select")}
                </Link>
              }
            >
              <Content isEditorial>
                {locale ? `${locale.name} - ${locale.territory}` : _("Wrong selection")}
              </Content>
            </Page.Section>
          </GridItem>
          <GridItem md={4}>
            <Page.Section
              title={_("Keyboard")}
              actions={
                <Link to={PATHS.keymapSelection} isPrimary={!keymap}>
                  {keymap ? _("Change") : _("Select")}
                </Link>
              }
            >
              <Content isEditorial>{keymap ? keymap.name : _("Wrong selection")}</Content>
            </Page.Section>
          </GridItem>
          <GridItem md={4}>
            <Page.Section
              title={_("Time zone")}
              actions={
                <Link to={PATHS.timezoneSelection} isPrimary={!timezone}>
                  {timezone ? _("Change") : _("Select")}
                </Link>
              }
            >
              <Content isEditorial>
                {timezone ? (timezone.parts || []).join(" - ") : _("Wrong selection")}
              </Content>
            </Page.Section>
          </GridItem>
          <GridItem>
            <Content>
              <InstallerL10nSettingsInfo />
            </Content>
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}
