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
import { Button, Form } from "@patternfly/react-core";

import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";
import { If, Page, Popup, Section } from "~/components/core";
import { LocaleSelector } from "~/components/l10n";
import { noop } from "~/utils";
import { useL10n } from "~/context/l10n";

const TimezoneSection = () => {
  return (
    <Section title={_("Time zone")} icon="schedule">
      <p>
        TODO
      </p>
    </Section>
  );
};

/**
 * Popup for selecting a locale.
 * @component
 *
 * @param {object} props
 * @param {function} props.onFinish - Callback to be called when the locale is correctly selected.
 * @param {function} props.onCancel - Callback to be called when the locale selection is canceled.
 */
const LocalePopup = ({ onFinish = noop, onCancel = noop }) => {
  const { l10n } = useInstallerClient();
  const { locales, selectedLocales } = useL10n();
  const [localeId, setLocaleId] = useState(selectedLocales[0]?.id);

  const sortedLocales = locales.sort((locale1, locale2) => {
    const localeText = l => [l.name, l.territory].join('').toLowerCase();
    return localeText(locale1) > localeText(locale2) ? 1 : -1;
  });

  const onSubmit = async (e) => {
    e.preventDefault();

    const [locale] = selectedLocales;

    if (localeId !== locale?.id) {
      await l10n.setLocales([localeId]);
    }

    onFinish();
  };

  return (
    <Popup
      title={_("Select language")}
      isOpen
    >
      <Form id="localeForm" onSubmit={onSubmit}>
        <LocaleSelector value={localeId} locales={sortedLocales} onChange={setLocaleId} />
      </Form>
      <Popup.Actions>
        <Popup.Confirm form="localeForm" type="submit">
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={onCancel} />
      </Popup.Actions>
    </Popup>
  );
};

const LocaleButton = ({ children }) => {
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
          <LocalePopup
            isOpen
            onFinish={closePopup}
            onCancel={closePopup}
          />
        }
      />
    </>
  );
};

const LocaleSection = () => {
  const { selectedLocales } = useL10n();

  const [locale] = selectedLocales;

  return (
    <Section title={_("Language")} icon="translate">
      <If
        condition={locale}
        then={
          <>
            <p>{locale?.name} - {locale?.territory}</p>
            <LocaleButton>{_("Change language")}</LocaleButton>
          </>
        }
        else={
          <>
            <p>{_("Language not selected yet")}</p>
            <LocaleButton>{_("Select language")}</LocaleButton>
          </>
        }
      />
    </Section>
  );
};

const KeyboardSection = () => {
  return (
    <Section title={_("Keyboard")} icon="keyboard">
      <p>
        TODO
      </p>
    </Section>
  );
};

export default function L10nPage() {
  return (
    <Page
      // TRANSLATORS: page title
      title={_("Localization")}
      icon="globe"
      actionLabel={_("Back")}
      actionVariant="secondary"
    >
      <TimezoneSection />
      <LocaleSection />
      <KeyboardSection />
    </Page>
  );
}
