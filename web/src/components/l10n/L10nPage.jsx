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
import {
  Card, CardHeader, CardTitle, CardBody, CardFooter,
  Gallery, GalleryItem,
  PageSection,
  Text,
} from "@patternfly/react-core";
import { Link } from "react-router-dom";
import { _ } from "~/i18n";
import { Icon } from "~/components/layout";
import { useL10n } from "~/context/l10n";

const Section = ({ title, icon, action, children }) => {
  return (
    <Card isLarge>
      <CardHeader>
        <CardTitle component="h2">
          <Icon name={icon} /> {title}
        </CardTitle>
      </CardHeader>
      <CardBody isFilled>
        {children}
      </CardBody>
      <CardFooter>
        {action}
      </CardFooter>
    </Card>
  );
};

/**
 * Page for configuring localization.
 * @component
 */
export default function L10nPage() {
  const {
    selectedKeymap: keymap,
    selectedTimezone: timezone,
    selectedLocales: [locale]
  } = useL10n();

  return (
    <PageSection>
      <Gallery hasGutter>
        <GalleryItem>
          <Section
            icon="translate"
            title={_("Language")}
            action={
              <Link to="language/select">{locale ? _("Change") : _("Select")}</Link>
            }
          >
            <Text>{locale ? `${locale.name} - ${locale.territory}` : _("Language not selected yet")}</Text>
          </Section>
        </GalleryItem>

        <GalleryItem>
          <Section
            icon="keyboard"
            title={_("Keyboard")}
            action={
              <Link to="keymap/select">{keymap ? _("Change") : _("Select")}</Link>
            }
          >
            <Text>{keymap ? keymap.name : _("Keyboard not selected yet")}</Text>
          </Section>
        </GalleryItem>

        <GalleryItem>
          <Section
            icon="schedule"
            title={_("Time zone")}
            action={
              <Link to="timezone/select">{timezone ? _("Change") : _("Select")}</Link>

            }
          >
            <Text>{timezone ? (timezone.parts || []).join(' - ') : _("Time zone not selected yet")}</Text>
          </Section>
        </GalleryItem>
      </Gallery>
    </PageSection>
  );
}
