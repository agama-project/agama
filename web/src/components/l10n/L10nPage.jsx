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

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { _ } from "~/i18n";
import { Section } from "~/components/core";
import { useL10n } from "~/context/l10n";

/**
 * Section for configuring timezone.
 * @component
 */
const TimezoneSection = () => {
  const { selectedTimezone: timezone } = useL10n();

  return (
    <Section title={_("Time zone")} icon="schedule">
      <p>
        {timezone ? (timezone.parts || []).join(' - ') : _("Time zone not selected yet")}
      </p>
      <Link to="timezone/select">
        {timezone ? _("Change time zone") : _("Select time zone")}
      </Link>
    </Section>
  );
};

/**
 * Section for configuring locales.
 * @component
 */
const LocaleSection = () => {
  const { selectedLocales } = useL10n();
  const [locale] = selectedLocales;

  return (
    <Section title={_("Language")} icon="translate">
      <p>
        {locale ? `${locale.name} - ${locale.territory}` : _("Language not selected yet")}
      </p>
      <Link to="language/select">
        {locale ? _("Change language") : _("Select language")}
      </Link>
    </Section>
  );
};

/**
 * Section for configuring keymaps.
 * @component
 */
const KeymapSection = () => {
  const { selectedKeymap: keymap } = useL10n();

  return (
    <Section title={_("Keyboard")} icon="keyboard">
      <p>
        {keymap ? keymap.name : _("Keyboard not selected yet")}
      </p>
      <Link to="keymap/select">
        {keymap ? _("Change keyboard") : _("Select keyboard")}
      </Link>
    </Section>
  );
};

/**
 * Page for configuring localization.
 * @component
 */
export default function L10nPage() {
  return (
    <>
      <LocaleSection />
      <KeymapSection />
      <TimezoneSection />
    </>
  );
}
