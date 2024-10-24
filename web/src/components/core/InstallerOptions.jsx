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

// @ts-check

import React, { useState } from "react";
import { Flex, Form, FormGroup, FormSelect, FormSelectOption } from "@patternfly/react-core";
import { Popup } from "~/components/core";
import { _ } from "~/i18n";
import { localConnection } from "~/utils";
import { useInstallerL10n } from "~/context/installerL10n";
import supportedLanguages from "~/languages.json";
import { useQuery } from "@tanstack/react-query";
import { keymapsQuery } from "~/queries/l10n";

/**
 * @typedef {import("@patternfly/react-core").ButtonProps} ButtonProps
 */

/**
 * Renders the installer options
 *
 * @todo Write documentation
 */
export default function InstallerOptions({ isOpen = false, onClose }) {
  const {
    language: initialLanguage,
    keymap: initialKeymap,
    changeLanguage,
    changeKeymap,
  } = useInstallerL10n();
  const [language, setLanguage] = useState(initialLanguage);
  const [keymap, setKeymap] = useState(initialKeymap);
  const { isPending, data: keymaps } = useQuery(keymapsQuery());
  const [inProgress, setInProgress] = useState(false);

  if (isPending) return;

  const close = () => {
    setLanguage(initialLanguage);
    setKeymap(initialKeymap);
    onClose();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setInProgress(true);
    changeKeymap(keymap);
    changeLanguage(language)
      .then(close)
      .catch(() => setInProgress(false));
  };

  return (
    <Popup isOpen={isOpen} title={_("Installer options")}>
      <Flex direction={{ default: "column" }} gap={{ default: "gapLg" }}>
        <Form id="installer-l10n" onSubmit={onSubmit}>
          <FormGroup fieldId="language" label={_("Language")}>
            <FormSelect
              id="language"
              name="language"
              aria-label={_("Language")}
              label={_("Language")}
              value={language}
              onChange={(_e, value) => setLanguage(value)}
            >
              {Object.keys(supportedLanguages)
                .sort()
                .map((id, index) => (
                  <FormSelectOption key={index} value={id} label={supportedLanguages[id]} />
                ))}
            </FormSelect>
          </FormGroup>

          <FormGroup fieldId="keymap" label={_("Keyboard layout")}>
            {localConnection() ? (
              <FormSelect
                id="keymap"
                name="keymap"
                label={_("Keyboard layout")}
                value={keymap}
                onChange={(_e, value) => setKeymap(value)}
              >
                {keymaps.map((keymap, index) => (
                  <FormSelectOption key={index} value={keymap.id} label={keymap.name} />
                ))}
              </FormSelect>
            ) : (
              _("Cannot be changed in remote installation")
            )}
          </FormGroup>
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
