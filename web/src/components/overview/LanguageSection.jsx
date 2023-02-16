/*
 * Copyright (c) [2023] SUSE LLC
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
 * find current contact information at www.suse.com.
 */

import React, { useReducer, useEffect } from "react";

import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { Section } from "~/components/core";
import { Text } from "@patternfly/react-core";

const initialState = {
  busy: true,
  language: undefined,
  errors: []
};

const reducer = (state, action) => {
  const { type: actionType, payload } = action;

  switch (actionType) {
    case "UPDATE_STATUS": {
      return { ...initialState, ...payload };
    }

    default: {
      return state;
    }
  }
};

export default function LanguageSection({ showErrors }) {
  const { language: languageClient } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();
  const [state, dispatch] = useReducer(reducer, initialState);

  const updateStatus = ({ ...payload }) => {
    dispatch({ type: "UPDATE_STATUS", payload });
  };

  useEffect(() => {
    const loadLanguages = async () => {
      const languages = await cancellablePromise(languageClient.getLanguages());
      const [current] = await cancellablePromise(languageClient.getSelectedLanguages());
      updateStatus({ languages, language: current, busy: false });
    };

    // TODO: use these errors?
    loadLanguages().catch(console.error);

    return languageClient.onLanguageChange(language => {
      updateStatus({ language });
    });
  }, [languageClient, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  const SectionContent = () => {
    if (state.busy) {
      // TODO: use skeletons instead?
      return "Retrieving language information...";
    }

    // FIXME: call it `current` instead of `language`?
    const { languages, language } = state;

    const summary = [];

    if (language) {
      const selectedLanguage = languages.find(lang => lang.id === language);
      summary.push(`${selectedLanguage.name} will be used as system language`);
    } else {
      summary.push("No language selected yet.");
    }

    return summary.map((sentence, idx) => <Text key={idx}>{sentence}</Text>);
  };

  return (
    <Section
      key="language-section"
      title="Language"
      iconName={ state.busy ? "loading" : "translate" }
      errors={errors}
    >
      <SectionContent />
    </Section>
  );
}
