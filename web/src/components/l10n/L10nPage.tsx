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
import { Content, Grid, GridItem } from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { L10N as PATHS } from "~/routes/paths";
import { useL10n } from "~/queries/l10n";
import { _ } from "~/i18n";

// FIXME: re-evaluate the need of "Thing not selected yet"

/**
 * Page for configuring localization.
 */
export default function L10nPage() {
  const { selectedLocale: locale, selectedTimezone: timezone, selectedKeymap: keymap } = useL10n();

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
                {locale ? `${locale.name} - ${locale.territory}` : _("Not selected yet")}
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
              <Content isEditorial>{keymap ? keymap.name : _("Not selected yet")}</Content>
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
                {timezone ? (timezone.parts || []).join(" - ") : _("Not selected yet")}
              </Content>
            </Page.Section>
          </GridItem>
        </Grid>
      </Page.Content>
    </Page>
  );
}
