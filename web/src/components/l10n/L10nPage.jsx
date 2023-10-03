/*
 * Copyright (c) [2022] SUSE LLC
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

import React, { useState, useEffect } from "react";
import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { _ } from "~/i18n";

import {
  Form,
  FormGroup,
  FormSelect,
  FormSelectOption
} from "@patternfly/react-core";

import { Page } from "~/components/core";

const initialState = {
  languages: [],
  language: ""
};

export default function LanguageSelector() {
  const { language: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, setState] = useState(initialState);
  const { languages, language } = state;

  const updateState = ({ ...payload }) => {
    setState(previousState => ({ ...previousState, ...payload }));
  };

  useEffect(() => {
    const loadLanguages = async () => {
      const languages = await cancellablePromise(client.getLanguages());
      const [language] = await cancellablePromise(client.getSelectedLanguages());
      updateState({ languages, language });
    };

    loadLanguages().catch(console.error);
  }, [client, cancellablePromise]);

  const accept = () => client.setLanguages([language]);

  const LanguageField = ({ selected }) => {
    const selectorOptions = languages.map(lang => (
      <FormSelectOption key={lang.id} value={lang.id} label={lang.name} />
    ));

    return (
      <FormGroup fieldId="language" label="Language">
        <FormSelect
          id="language"
          aria-label={_("language")}
          value={selected}
          onChange={(_, v) => updateState({ language: v })}
        >
          {selectorOptions}
        </FormSelect>
      </FormGroup>
    );
  };

  return (
    // TRANSLATORS: page header
    <Page title={_("Localization")} icon="translate" actionCallback={accept}>
      <Form id="language-selector">
        <LanguageField selected={language} />
      </Form>
    </Page>
  );
}
