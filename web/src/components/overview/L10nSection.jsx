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

import React, { useEffect, useState } from "react";

import { useCancellablePromise } from "~/utils";
import { useInstallerClient } from "~/context/installer";
import { Section, SectionSkeleton } from "~/components/core";
import { Text, Label } from "@patternfly/react-core";

const initialState = {
  busy: true,
  language: undefined,
  errors: []
};

export default function LanguageSection({ showErrors }) {
  const [state, setState] = useState(initialState);
  const { language: client } = useInstallerClient();
  const { cancellablePromise } = useCancellablePromise();

  const updateState = ({ ...payload }) => {
    setState(previousState => ({ ...previousState, ...payload }));
  };

  useEffect(() => {
    const loadLanguages = async () => {
      const languages = await cancellablePromise(client.getLanguages());
      const [language] = await cancellablePromise(client.getSelectedLanguages());
      updateState({ languages, language, busy: false });
    };

    // TODO: use these errors?
    loadLanguages().catch(console.error);

    return client.onLanguageChange(language => {
      updateState({ language });
    });
  }, [client, cancellablePromise]);

  const errors = showErrors ? state.errors : [];

  const SectionContent = () => {
    const { busy, languages, language } = state;

    if (busy) return <SectionSkeleton />;

    const selected = languages.find(lang => lang.id === language);
    console.log("selected", selected);
    return (
      <Text>
        The system will use <Label isCompact>{`${selected.name} (${selected.id})`}</Label> as its default language.
      </Text>
    );
  };

  return (
    <Section
      key="l10n-section"
      title="Localization"
      loading={state.busy}
      icon="translate"
      path="/l10n"
      errors={errors}
    >
      <SectionContent />
    </Section>
  );
}
