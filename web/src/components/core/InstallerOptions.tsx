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

import React, { useState } from "react";
import {
  Checkbox,
  Flex,
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption,
} from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { useQuery } from "@tanstack/react-query";
import { localConnection } from "~/utils";
import { useInstallerL10n } from "~/context/installerL10n";
import { keymapsQuery, useConfigMutation, useL10n } from "~/queries/l10n";
import supportedLanguages from "~/languages.json";
import { _ } from "~/i18n";
import { LocaleConfig } from "~/types/l10n";

type InstallerOptionsProps = {
  isOpen: boolean;
  onClose?: () => void;
};

const LangaugeFormInput = ({ value, onChange }) => (
  <FormGroup fieldId="language" label={_("Language")}>
    <FormSelect
      id="language"
      name="language"
      value={value}
      onChange={(_, value) => onChange(value)}
    >
      {Object.keys(supportedLanguages)
        .sort()
        .map((id, index) => (
          <FormSelectOption key={index} value={id} label={supportedLanguages[id]} />
        ))}
    </FormSelect>
  </FormGroup>
);

const KeyboardFormInput = ({ value, onChange }) => {
  const { isPending, data: keymaps } = useQuery(keymapsQuery());
  if (isPending) return;

  if (!localConnection()) {
    return (
      <FormGroup label={_("Keyboard layout")}>
        {_("Cannot be changed in remote installation")}
      </FormGroup>
    );
  }

  return (
    <FormGroup fieldId="keymap" label={_("Keyboard layout")}>
      <FormSelect
        id="keymap"
        name="keymap"
        label={_("Keyboard layout")}
        value={value}
        onChange={(_, value) => onChange(value)}
      >
        {keymaps.map((keymap, index) => (
          <FormSelectOption key={index} value={keymap.id} label={keymap.name} />
        ))}
      </FormSelect>
    </FormGroup>
  );
};

const CopyToSystemInput = ({ value, onChange }) => {
  const label = localConnection()
    ? _("Use these same settings for the selected product")
    : _("Use for selected product too");
  const description = _(
    "More language and keyboard layout options for the selected product may be available in Localization page.",
  );

  return (
    <FormGroup fieldId="copy-to-system">
      <Checkbox
        id="copy-to-system"
        label={label}
        description={description}
        isChecked={value}
        onChange={onChange}
      />
    </FormGroup>
  );
};

/**
 * Renders the installer options
 */
export default function InstallerOptions({ isOpen = false, onClose }: InstallerOptionsProps) {
  const {
    language: initialLanguage,
    keymap: initialKeymap,
    changeLanguage,
    changeKeymap,
  } = useInstallerL10n();

  const { mutate: updateSystemL10n } = useConfigMutation();
  const { locales } = useL10n();
  const [language, setLanguage] = useState(initialLanguage);
  const [keymap, setKeymap] = useState(initialKeymap);
  const [copyToSystem, setCopyToSystem] = useState(true);
  const [inProgress, setInProgress] = useState<boolean>(false);
  const toggleCopyToSystem = () => setCopyToSystem(!copyToSystem);

  const close = () => {
    setLanguage(initialLanguage);
    setKeymap(initialKeymap);
    onClose();
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setInProgress(true);

    // FIXME: export and use languageToLocale from context/installerL10n
    const systemLocale = locales.find((l) => l.id.startsWith(language.replace("-", "_")));
    const systeml10n: Partial<LocaleConfig> = {
      locales: [systemLocale.id],
      keymap,
    };

    if (localConnection()) {
      await changeKeymap(keymap);
    } else {
      delete systeml10n.keymap;
    }

    if (copyToSystem) {
      updateSystemL10n(systeml10n);
    }

    changeLanguage(language)
      .then(close)
      .catch(() => setInProgress(false));
  };

  return (
    <Popup isOpen={isOpen} variant="small" title={_("Language & Keyboard")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
        <Form id="installer-l10n" onSubmit={onSubmit}>
          <LangaugeFormInput value={language} onChange={setLanguage} />
          <KeyboardFormInput value={keymap} onChange={setKeymap} />
          <CopyToSystemInput value={copyToSystem} onChange={toggleCopyToSystem} />
        </Form>
      </Flex>

      <Popup.Actions>
        <Popup.Confirm
          form="installer-l10n"
          type="submit"
          autoFocus
          isDisabled={inProgress}
          isLoading={inProgress}
        >
          {_("Accept")}
        </Popup.Confirm>
        <Popup.Cancel onClick={close} isDisabled={inProgress} />
      </Popup.Actions>
    </Popup>
  );
}
