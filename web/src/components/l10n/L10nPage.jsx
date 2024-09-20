/*
 * Copyright (c) [2022-2023] SUSE LLC
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
import { Gallery, GalleryItem } from "@patternfly/react-core";
import { Link, Page } from "~/components/core";
import { PATHS } from "~/routes/l10n";
import { _ } from "~/i18n";
import { useL10n } from "~/queries/l10n";

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

      <Page.Content>
        <Gallery hasGutter minWidths={{ default: "300px" }}>
          <GalleryItem>
            <Page.Section
              title={_("Language")}
              value={locale ? `${locale.name} - ${locale.territory}` : _("Not selected yet")}
            >
              <Link to={PATHS.localeSelection} isPrimary={!locale}>
                {locale ? _("Change") : _("Select")}
              </Link>
            </Page.Section>
          </GalleryItem>

          <GalleryItem>
            <Page.Section
              title={_("Keyboard")}
              value={keymap ? keymap.name : _("Not selected yet")}
            >
              <Link to={PATHS.keymapSelection} isPrimary={!keymap}>
                {keymap ? _("Change") : _("Select")}
              </Link>
            </Page.Section>
          </GalleryItem>

          <GalleryItem>
            <Page.Section
              title={_("Time zone")}
              value={timezone ? (timezone.parts || []).join(" - ") : _("Not selected yet")}
            >
              <Link to={PATHS.timezoneSelection} isPrimary={!timezone}>
                {timezone ? _("Change") : _("Select")}
              </Link>
            </Page.Section>
          </GalleryItem>
        </Gallery>
      </Page.Content>
    </Page>
  );
}
