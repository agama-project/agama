/*
 * Copyright (c) [2023-2024] SUSE LLC
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

import React, { useState } from "react";
import { Form, FormGroup, Radio, Text } from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { ListSearch, Page } from "~/components/core";
import { _ } from "~/i18n";
import { useConfigMutation, useL10n } from "~/queries/l10n";
import textStyles from "@patternfly/react-styles/css/utilities/Text/text";

// TODO: Add documentation
// TODO: Evaluate if worth it extracting the selector
export default function KeyboardSelection() {
  const navigate = useNavigate();
  const setConfig = useConfigMutation();
  const { keymaps, selectedKeymap: currentKeymap } = useL10n();
  const [selected, setSelected] = useState(currentKeymap.id);
  const [filteredKeymaps, setFilteredKeymaps] = useState(
    keymaps.sort((k1, k2) => (k1.name > k2.name ? 1 : -1)),
  );

  const searchHelp = _("Filter by description or keymap code");

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setConfig.mutate({ keymap: selected });
    navigate(-1);
  };

  let keymapsList = filteredKeymaps.map(({ id, name }) => {
    return (
      <Radio
        id={id}
        key={id}
        name="keymap"
        onChange={() => setSelected(id)}
        label={
          <>
            <span className={`${textStyles.fontSizeLg}`}>
              <b>{name}</b>
            </span>{" "}
            <Text component="small">{id}</Text>
          </>
        }
        value={id}
        isChecked={id === selected}
      />
    );
  });

  if (keymapsList.length === 0) {
    keymapsList = [<b>{_("None of the keymaps match the filter.")}</b>];
  }

  return (
    <Page>
      <Page.Header>
        <h2>{_("Keyboard selection")}</h2>
        <ListSearch placeholder={searchHelp} elements={keymaps} onChange={setFilteredKeymaps} />
      </Page.Header>

      <Page.Content>
        <Page.Section>
          <Form id="keymapSelection" onSubmit={onSubmit}>
            <FormGroup isStack>{keymapsList}</FormGroup>
          </Form>
        </Page.Section>
      </Page.Content>

      <Page.Actions>
        <Page.Cancel />
        <Page.Submit form="keymapSelection">{_("Select")}</Page.Submit>
      </Page.Actions>
    </Page>
  );
}
