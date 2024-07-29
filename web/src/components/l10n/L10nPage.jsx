/*
 * Copyright (c) [2022-2023] SUSE LLC
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
 * find language contact information at www.suse.com.
 */

import React from "react";
import { Gallery, GalleryItem } from "@patternfly/react-core";
import { ButtonLink, CardField, Page } from "~/components/core";
import { PATHS } from "~/routes/l10n";
import { _ } from "~/i18n";
import { useL10n } from "~/queries/l10n";

const Section = ({ label, value, children }) => {
  return (
    <CardField label={label} value={value}>
      <CardField.Content>{children}</CardField.Content>
    </CardField>
  );
};

// FIXME: re-evaluate the need of "Thing not selected yet"
/**
 * Page for configuring localization.
 * @component
 */
export default function L10nPage() {
  const { selectedLocale: locale, selectedTimezone: timezone, selectedKeymap: keymap } = useL10n();

  return (
    <Page>
      <Page.Header>
        <h2>{_("Localization")}</h2>
      </Page.Header>

      <Page.MainContent>
        <Gallery hasGutter minWidths={{ default: "300px" }}>
          <GalleryItem>
            <Section
              label={_("Language")}
              value={locale ? `${locale.name} - ${locale.territory}` : _("Not selected yet")}
            >
              <ButtonLink to={PATHS.localeSelection} isPrimary={!locale}>
                {locale ? _("Change") : _("Select")}
              </ButtonLink>
            </Section>
          </GalleryItem>

          <GalleryItem>
            <Section label={_("Keyboard")} value={keymap ? keymap.name : _("Not selected yet")}>
              <ButtonLink to={PATHS.keymapSelection} isPrimary={!keymap}>
                {keymap ? _("Change") : _("Select")}
              </ButtonLink>
            </Section>
          </GalleryItem>

          <GalleryItem>
            <Section
              label={_("Time zone")}
              value={timezone ? (timezone.parts || []).join(" - ") : _("Not selected yet")}
            >
              <ButtonLink to={PATHS.timezoneSelection} isPrimary={!timezone}>
                {timezone ? _("Change") : _("Select")}
              </ButtonLink>
            </Section>
          </GalleryItem>
        </Gallery>
      </Page.MainContent>
    </Page>
  );
}
