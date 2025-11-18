/*
 * Copyright (c) [2023-2025] SUSE LLC
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
import { Content, Flex, Form, FormGroup, Radio } from "@patternfly/react-core";
import { useNavigate } from "react-router";
import { ListSearch, Page } from "~/components/core";
import { patchConfig } from "~/api";
import { useSystem, useProposal } from "~/hooks/api";
import { _ } from "~/i18n";

// TODO: Add documentation
// TODO: Evaluate if worth it extracting the selector
export default function KeyboardSelection() {
  const navigate = useNavigate();
  const {
    l10n: { keymaps },
  } = useSystem();
  const {
    l10n: { keymap: currentKeymap },
  } = useProposal();

  // FIXME: get current keymap from either, proposal or config
  const [selected, setSelected] = useState(currentKeymap);
  const [filteredKeymaps, setFilteredKeymaps] = useState(
    keymaps.sort((k1, k2) => (k1.description > k2.description ? 1 : -1)),
  );

  const searchHelp = _("Filter by description or keymap code");

  const onSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    // FIXME: udpate when new API is ready
    patchConfig({ l10n: { keymap: selected } });
    navigate(-1);
  };

  let keymapsList = filteredKeymaps.map(({ id, description }) => {
    return (
      <Radio
        id={id}
        key={id}
        name="keymap"
        onChange={() => setSelected(id)}
        label={
          <Flex columnGap={{ default: "columnGapSm" }}>
            <Content isEditorial>{description}</Content>
            <Content component="small">{id}</Content>
          </Flex>
        }
        value={id}
        isChecked={id === selected}
      />
    );
  });

  if (keymapsList.length === 0) {
    keymapsList = [<b key="notfound">{_("None of the keymaps match the filter.")}</b>];
  }

  return (
    <Page>
      <Page.Header>
        <Content component="h2">{_("Keyboard selection")}</Content>
        <ListSearch placeholder={searchHelp} elements={keymaps} onChange={setFilteredKeymaps} />
      </Page.Header>

      <Page.Content>
        <Form id="keymapSelection" onSubmit={onSubmit}>
          <FormGroup isStack>{keymapsList}</FormGroup>
        </Form>
      </Page.Content>

      <Page.Actions>
        <Page.Submit form="keymapSelection">{_("Select")}</Page.Submit>
        <Page.Cancel />
      </Page.Actions>
    </Page>
  );
}
