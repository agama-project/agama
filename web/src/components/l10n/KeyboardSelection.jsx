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

import React, { useEffect, useState } from "react";
import {
  Form, FormGroup,
  Radio,
  Text
} from "@patternfly/react-core";
import { useNavigate } from "react-router-dom";
import { _ } from "~/i18n";
import { useL10n } from "~/context/l10n";
import { useInstallerClient } from "~/context/installer";
import { ListSearch, Page } from "~/components/core";
import textStyles from '@patternfly/react-styles/css/utilities/Text/text';

// TODO: Add documentation and typechecking
// TODO: Evaluate if worth it extracting the selector
export default function KeyboardSelection() {
  const { l10n } = useInstallerClient();
  const { keymaps, selectedKeymap: currentKeymap } = useL10n();
  const [selected, setSelected] = useState(currentKeymap);
  const [filteredKeymaps, setFilteredKeymaps] = useState(keymaps);
  const navigate = useNavigate();

  const sortedKeymaps = keymaps.sort((k1, k2) => k1.name > k2.name ? 1 : -1);
  const searchHelp = _("Filter by description or keymap code");

  useEffect(() => {
    setFilteredKeymaps(sortedKeymaps);
  }, [sortedKeymaps, setFilteredKeymaps]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const dataForm = new FormData(e.target);
    const nextKeymapId = JSON.parse(dataForm.get("keymap"))?.id;

    if (nextKeymapId !== currentKeymap?.id) {
      await l10n.setKeymap(nextKeymapId);
    }

    navigate("..");
  };

  let keymapsList = filteredKeymaps.map((keymap) => {
    return (
      <Radio
        key={keymap.id}
        name="keymap"
        id={keymap.id}
        onChange={() => setSelected(keymap)}
        label={
          <>
            <span className={`${textStyles.fontSizeLg}`}>
              <b>{keymap.name}</b>
            </span> <Text component="small">{keymap.id}</Text>
          </>
        }
        value={JSON.stringify(keymap)}
        defaultChecked={keymap === selected}
      />
    );
  });

  if (keymapsList.length === 0) {
    keymapsList = (
      <b>{_("None of the keymaps match the filter.")}</b>
    );
  }

  return (
    <>
      <Page.Header>
        <h2>{_("Keyboard selection")}</h2>
        <ListSearch placeholder={searchHelp} elements={keymaps} onChange={setFilteredKeymaps} />
      </Page.Header>
      <Page.MainContent>
        <Page.CardSection>
          <Form id="keymapSelection" onSubmit={onSubmit}>
            <FormGroup isStack>
              {keymapsList}
            </FormGroup>
          </Form>
        </Page.CardSection>
      </Page.MainContent>
      <Page.NextActions>
        <Page.CancelAction />
        <Page.Action type="submit" form="keymapSelection">
          {_("Select")}
        </Page.Action>
      </Page.NextActions>
    </>
  );
}
