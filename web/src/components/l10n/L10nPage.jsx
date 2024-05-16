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
import { Button, Form } from "@patternfly/react-core";
import { sprintf } from "sprintf-js";

import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { If, Popup, Section } from "~/components/core";
import { TimezoneSelector } from "~/components/l10n";
import { noop } from "~/utils";
import { useL10n } from "~/context/l10n";
import { useProduct } from "~/context/product";

/**
 * Popup for selecting a timezone.
 * @component
 *
 * @param {object} props
 * @param {function} props.onFinish - Callback to be called when the timezone is correctly selected.
 * @param {function} props.onCancel - Callback to be called when the timezone selection is canceled.
 */
const TimezonePopup = ({ onFinish = noop, onCancel = noop }) => {
  const { l10n } = useInstallerClient();
  const { timezones, selectedTimezone } = useL10n();

  const [timezoneId, setTimezoneId] = useState(selectedTimezone?.id);
  const { selectedProduct } = useProduct();
  const sortedTimezones = timezones.sort((timezone1, timezone2) => {
    const timezoneText = t => t.parts.join('').toLowerCase();
    return timezoneText(timezone1) > timezoneText(timezone2) ? 1 : -1;
  });

  const onSubmit = async (e) => {
    e.preventDefault();

    if (timezoneId !== selectedTimezone?.id) {
      await l10n.setTimezone(timezoneId);
    }

    onFinish();
  };

  return (
    <Popup
      isOpen
      title={_("Select time zone")}
      description={sprintf(_("%s will use the selected time zone."), selectedProduct.name)}
      blockSize="large"
    >
      <Form id="timezoneForm" onSubmit={onSubmit}>
        <TimezoneSelector value={timezoneId} timezones={sortedTimezones} onChange={setTimezoneId} />
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="timezoneForm" type="submit">
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
};

/**
 * Button for opening the selection of timezone.
 * @component
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Button children.
 */
const TimezoneButton = ({ children }) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const openPopup = () => setIsPopupOpen(true);
  const closePopup = () => setIsPopupOpen(false);

  return (
    <>
      <Button
        variant="link"
        className="p-0"
        onClick={openPopup}
      >
        {children}
      </Button>

      <If
        condition={isPopupOpen}
        then={
          <TimezonePopup
            isOpen
            onFinish={closePopup}
            onCancel={closePopup}
          />
        }
      />
    </>
  );
};

/**
 * Section for configuring timezone.
 * @component
 */
const TimezoneSection = () => {
  const { selectedTimezone } = useL10n();

  return (
    <Section title={_("Time zone")} icon="schedule">
      <If
        condition={selectedTimezone}
        then={
          <>
            <p>{(selectedTimezone?.parts || []).join(' - ')}</p>
            <TimezoneButton>{_("Change time zone")}</TimezoneButton>
          </>
        }
        else={
          <>
            <p>{_("Time zone not selected yet")}</p>
            <TimezoneButton>{_("Select time zone")}</TimezoneButton>
          </>
        }
      />
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
  const { keymap } = useL10n();

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
